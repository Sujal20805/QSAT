import os
import json
import joblib
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Configuration ---
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "trained_soil_models_reduced")
DATA_DIR = os.path.join(BASE_DIR, "backend_data")
METRICS_FILE = os.path.join(DATA_DIR, "metrics.json")
IMPORTANCE_FILE = os.path.join(DATA_DIR, "feature_importance.json")
CATEGORIES_FILE = os.path.join(DATA_DIR, "soil_categories.json")
TOP_FEATURES_FILE = os.path.join(DATA_DIR, "top_features_used.json") # Crucial

EXPECTED_TARGET_KEYS = [
    'pH', 'nitro', 'phosphorus', 'potassium', 'capacityMoist',
    'temperature', 'moisture', 'electricalConductivity'
]
EXPECTED_WATER_LEVEL_KEYS = ['0ml', '25ml', '50ml']
N_TOP_FEATURES = 4 # Must match training!

# --- Flask App Initialization ---
app = Flask(__name__)
CORS(app)

# --- Load Data at Startup ---
def load_json_data(filepath):
    if not os.path.exists(filepath):
        print(f"Error: Data file not found at {filepath}")
        return None
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading or parsing JSON from {filepath}: {e}")
        return None

print("--- Loading backend data ---")
metrics_data = load_json_data(METRICS_FILE)
importance_data = load_json_data(IMPORTANCE_FILE)
soil_categories = load_json_data(CATEGORIES_FILE)
top_features_data = load_json_data(TOP_FEATURES_FILE)

if not all([metrics_data, importance_data, soil_categories, top_features_data]):
    print("CRITICAL Error: One or more essential data files failed to load. Check paths in backend_data/.")
else:
    print("Backend data loaded successfully.")
    if soil_categories: print(f"Loaded {len(soil_categories)} soil categories.")
    if not top_features_data: print("Warning: Top features data not loaded.")


# --- Helper Functions ---
def get_model_filename(target_key, wl_key):
    """Constructs the expected model filename."""
    safe_target_name = "".join(c if c.isalnum() else "_" for c in target_key)
    wl_number_str = wl_key.replace('ml', '')
    filename = f"model_reduced_{safe_target_name}_WL{wl_number_str}ml_top{N_TOP_FEATURES}.joblib"
    return os.path.join(MODEL_DIR, filename)

def format_value(value, key):
     """Formats prediction values for JSON output."""
     if value is None or pd.isna(value): return None
     try:
         float_value = float(value)
         if key in ['pH', 'electricalConductivity', 'temperature', 'moisture', 'capacityMoist']: return round(float_value, 1)
         elif key in ['nitro', 'phosphorus', 'potassium']: return round(float_value, 0)
         else: return round(float_value, 2)
     except: return None


# --- API Endpoints ---
@app.route('/api/analyze', methods=['POST'])
def analyze_soil():
    print("\nReceived /api/analyze request")
    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400
    data = request.get_json()
    print(f"Received data: {json.dumps(data)}") # Log incoming data

    # --- Validate Input ---
    water_level_raw = data.get('waterLevel')
    wavelengths_input_user = data.get('wavelengths') # User provided wavelengths

    if water_level_raw is None or wavelengths_input_user is None:
        return jsonify({"error": "Missing 'waterLevel' or 'wavelengths'"}), 400
    if not isinstance(wavelengths_input_user, dict):
         return jsonify({"error": "'wavelengths' must be a dictionary"}), 400

    try:
        water_level = float(water_level_raw)
        wl_key = f"{int(water_level)}ml"
        if wl_key not in EXPECTED_WATER_LEVEL_KEYS:
             return jsonify({"error": f"Water level {water_level}ml not supported (Use 0, 25, 50)."}), 400
    except ValueError:
         return jsonify({"error": "'waterLevel' must be a valid number"}), 400

    # Check essential data
    if not soil_categories or not top_features_data or not metrics_data:
         print("Error: Essential data missing.")
         return jsonify({"error": "Server configuration error"}), 500

    assumed_soil_code = soil_categories[0]
    print(f"Using assumed Soil_Code: '{assumed_soil_code}'")

    # --- Perform Predictions ---
    predictions = {}
    print(f"Predicting for Water Level Key: {wl_key}")

    # Log the wavelengths provided by the user ONCE per request
    user_provided_wavelengths = list(wavelengths_input_user.keys())
    print(f"User provided wavelengths: {user_provided_wavelengths}")

    for target_key in EXPECTED_TARGET_KEYS:
        print(f"  Processing target: {target_key}")
        target_pred = None
        model_loaded = False # Flag to track if model file exists and is loaded

        # 1. Get required spectral features for THIS model
        required_spectral_features = []
        try:
            required_spectral_features = top_features_data.get(wl_key, {}).get(target_key, [])
            print(f"    Model requires spectral features: {required_spectral_features or 'None listed'}") # Log required features

            if not required_spectral_features:
                 # Check for constant zero case (e.g., NPK at WL 0)
                 mae_status = metrics_data.get('MAE',{}).get(wl_key,{}).get(target_key)
                 if target_key in ['nitro', 'phosphorus', 'potassium'] and wl_key == '0ml' and mae_status == 0.0:
                      print("    Applying 0 prediction (Constant_Zero_Train).")
                      target_pred = 0.0
                 else:
                      print(f"    Warning: No spectral features defined for {target_key}@{wl_key} and not constant zero. Prediction = None.")
                 predictions[target_key] = format_value(target_pred, target_key)
                 continue # Skip to next target

        except Exception as e:
             print(f"    Error retrieving required features: {e}")
             predictions[target_key] = format_value(None, target_key)
             continue

        # 2. Check if USER PROVIDED all required spectral features
        missing_user_inputs = [f for f in required_spectral_features if f not in wavelengths_input_user]

        if missing_user_inputs:
            print(f"    Cannot predict {target_key}: User input MISSING required wavelength(s): {missing_user_inputs}")
            target_pred = None
        else:
            # 3. Prepare input dict & DataFrame for THIS model
            print(f"    User provided required wavelengths: {required_spectral_features}")
            model_input_dict = {'Soil_Code': assumed_soil_code}
            valid_input = True
            for feature in required_spectral_features:
                try:
                    value = wavelengths_input_user[feature]
                    if value is None or str(value).strip() == '':
                         raise ValueError("Input value is empty")
                    model_input_dict[feature] = float(value)
                except (ValueError, TypeError, KeyError) as e:
                     print(f"    Error: Invalid/missing input for required feature '{feature}': {e}. Cannot predict {target_key}.")
                     target_pred = None
                     valid_input = False
                     break

            if valid_input:
                try:
                    model_features_list = ['Soil_Code'] + required_spectral_features
                    model_input_df = pd.DataFrame([model_input_dict], columns=model_features_list)
                    model_input_df['Soil_Code'] = pd.Categorical(model_input_df['Soil_Code'], categories=soil_categories, ordered=False)

                    if model_input_df['Soil_Code'].isnull().any():
                        print("    Error: NaN created in Soil_Code.")
                        target_pred = None
                    else:
                        # 4. Load the specific model file
                        model_filename = get_model_filename(target_key, wl_key)
                        print(f"    Attempting to load model: {model_filename}")
                        if os.path.exists(model_filename):
                            try:
                                model = joblib.load(model_filename)
                                model_loaded = True # Mark as loaded successfully
                                # 5. Predict
                                print(f"    Predicting using features: {model_input_df.columns.tolist()}")
                                print(f"    Input data for prediction:\n{model_input_df.to_string()}")
                                prediction_array = model.predict(model_input_df)
                                target_pred = prediction_array[0]
                                print(f"    Raw Prediction: {target_pred}")
                            except Exception as e:
                                print(f"    Error loading/predicting with model {model_filename}: {e}")
                                target_pred = None
                        else:
                            print(f"    Error: Model file does not exist: {model_filename}")
                            target_pred = None
                except Exception as e:
                    print(f"    Error creating DataFrame or applying category: {e}")
                    target_pred = None

        # 6. Store formatted prediction
        # Add extra check: If model didn't load or prediction failed, ensure None
        if valid_input and not model_loaded and target_pred is not None:
             print(f"    Resetting prediction to None because model didn't load/predict correctly.") # Safety check
             target_pred = None

        predictions[target_key] = format_value(target_pred, target_key)
        print(f"    Prediction stored for {target_key}: {predictions[target_key]}")


    print(f"Final predictions payload: {json.dumps(predictions)}")
    return jsonify(predictions)


# --- Other Endpoints (Metrics, Top Wavelengths - No changes needed) ---
@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    if metrics_data: return jsonify(metrics_data)
    else: return jsonify({"error": "Metrics data not available"}), 503

@app.route('/api/top-wavelengths', methods=['GET'])
def get_top_wavelengths():
    attribute_key = request.args.get('attribute')
    count_str = request.args.get('count')
    # Input Validation
    if not attribute_key or attribute_key not in EXPECTED_TARGET_KEYS: return jsonify({"error": "Missing/invalid 'attribute'"}), 400
    try: count = int(count_str); assert count > 0
    except: return jsonify({"error": "'count' must be positive integer"}), 400
    if not importance_data: return jsonify({"error": "Importance data unavailable"}), 503

    # Retrieve and Rank
    representative_wl_key = '25ml'
    if representative_wl_key not in importance_data:
         available_wls = list(importance_data.keys())
         if not available_wls: return jsonify({"error": "No importance data found"}), 404
         representative_wl_key = available_wls[0]
         print(f"Warn: Using {representative_wl_key} for importance.")

    target_importance_list = importance_data.get(representative_wl_key, {}).get(attribute_key)
    if not isinstance(target_importance_list, list): return jsonify({"error": f"No/invalid importance data for '{attribute_key}'"}), 404

    # Sort valid importance scores
    sorted_importances = sorted(
        [item for item in target_importance_list if isinstance(item.get('importance'), (int, float)) and not pd.isna(item['importance'])],
        key=lambda x: x['importance'], reverse=True
    )
    # Prepare output
    ranked_wavelengths = [{
        "rank": i + 1, "wavelength": item['feature'], "importanceScore": round(item['importance'], 4)
    } for i, item in enumerate(sorted_importances[:count])]
    return jsonify(ranked_wavelengths)

# --- Root Route ---
@app.route('/')
def index(): return "Soil Spectrometer Backend API is running."

# --- Run App ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)