# -*- coding: utf-8 -*-
"""
HackNUThon_AllStats_Final_BackendPrep.py (Enhanced Debugging)

Modified version of the original script to:
- Remove SHAP and Matplotlib plotting.
- Save metrics, feature importances, and soil categories for Flask backend use.
- Added enhanced debugging for metric storage and saving.
"""

# ==============================================================================
#                           IMPORTS & CONFIGURATION
# ==============================================================================
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import lightgbm as lgb
import joblib
import os
import warnings
import json
import traceback # Added for detailed error printing
import pprint # Added for inspecting dictionary

# Suppress specific LightGBM warnings
warnings.filterwarnings("ignore", message="Using categorical_feature in Dataset.")
warnings.filterwarnings("ignore", message="categorical_feature in Dataset is overridden")
warnings.filterwarnings('ignore', message=r"\[LightGBM\] \[Warning\] No further splits with positive gain, best gain: -inf")

# --- Configuration ---
DATA_FILE = 'modified_dataset.csv'
MODEL_SAVE_DIR_REDUCED = "trained_soil_models_reduced"
BACKEND_DATA_DIR = "backend_data"
N_TOP_FEATURES = 4
MIN_TRAIN_SAMPLES = 10
MIN_TEST_SAMPLES = 5

# --- Create directories ---
os.makedirs(MODEL_SAVE_DIR_REDUCED, exist_ok=True)
os.makedirs(BACKEND_DATA_DIR, exist_ok=True)

print(f"Configuration:")
print(f"  Data file: {DATA_FILE}")
print(f"  Reduced models saved in: '{MODEL_SAVE_DIR_REDUCED}'")
print(f"  Backend data saved in: '{BACKEND_DATA_DIR}'")
print(f"  Target dir exists: {os.path.exists(BACKEND_DATA_DIR)}") # Verify dir exists
print("-" * 50)

# ==============================================================================
#                               LOAD DATA
# ==============================================================================
print("\n--- Loading Data ---")
try:
    df = pd.read_csv(DATA_FILE)
    print(f"Data loaded successfully. Shape: {df.shape}")
except Exception as e:
    print(f"FATAL ERROR loading data: {e}")
    exit()

# ==============================================================================
#                      DEFINE FEATURES, TARGETS, & LEVELS
# ==============================================================================
print("\n--- Defining Features, Targets, and Water Levels ---")
spectral_cols = ['410', '435', '460', '485', '510', '535', '560', '585', '610', '645', '680', '705', '730', '760', '810', '860', '900', '940']
target_mapping = { 'Ph': 'pH', 'Nitro': 'nitro', 'Posh Nitro': 'phosphorus', 'Pota Nitro': 'potassium', 'Capacitity Moist': 'capacityMoist', 'Temp': 'temperature', 'Moist': 'moisture', 'EC': 'electricalConductivity' }
original_target_cols = list(target_mapping.keys())
frontend_target_keys = list(target_mapping.values())
WATER_LEVELS_TO_PROCESS = [0, 25, 50]
water_level_keys = {wl: f"{wl}ml" for wl in WATER_LEVELS_TO_PROCESS}
initial_feature_cols = ['Soil_Code', 'Water_Level'] + spectral_cols
features_for_per_level_model = ['Soil_Code'] + spectral_cols

# --- Verify columns ---
all_needed_cols = list(set(initial_feature_cols + original_target_cols))
missing_cols = [col for col in all_needed_cols if col not in df.columns]
if missing_cols:
    print(f"\nFATAL ERROR: Missing columns in DataFrame: {missing_cols}")
    exit()
else:
    print("All required columns found.")

# --- Convert Soil_Code ---
print("\nConverting 'Soil_Code' to categorical type...")
train_soil_code_categories = None
try:
    if df['Soil_Code'].dtype.name != 'category':
         df['Soil_Code'] = df['Soil_Code'].astype('category')
         print("'Soil_Code' converted.")
    else:
         print("'Soil_Code' already categorical.")
except Exception as e:
    print(f"FATAL ERROR during 'Soil_Code' conversion: {e}")
    exit()

# ==============================================================================
#                            SPLIT DATA
# ==============================================================================
print("\n--- Splitting Data ---")
X = df[initial_feature_cols]
y = df[original_target_cols]
try:
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=X['Water_Level'])
    print("Stratified split successful.")
except Exception as e:
     print(f"Warning performing stratified split: {e}. Performing regular split.")
     X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# --- Define categories from TRAINING data ONLY ---
try:
    train_soil_code_categories = X_train['Soil_Code'].cat.categories
    print(f"Training Soil Code Categories: {train_soil_code_categories.tolist()}")
except Exception as e:
    print(f"FATAL ERROR getting train soil categories: {e}")
    exit()

# --- SAVE SOIL CATEGORIES (Save early to confirm writing works) ---
categories_filepath = os.path.join(BACKEND_DATA_DIR, "soil_categories.json")
try:
    with open(categories_filepath, 'w') as f:
        json.dump(train_soil_code_categories.tolist(), f)
    print(f"Saved training soil categories to '{categories_filepath}' (Write Test OK)")
except Exception as e:
    print(f"ERROR saving soil categories: {e}")
    # Don't exit yet, maybe other things work

print(f"Data Split Shapes: X_train={X_train.shape}, y_train={y_train.shape}, X_test={X_test.shape}, y_test={y_test.shape}")


# ==============================================================================
#    TRAIN FULL MODELS (Needed for Importance) & EVALUATE & PREP REDUCED
# ==============================================================================
print("\n" + "=" * 60)
print(" Processing Models (Full for Importance, Reduced for Prediction)")
print("=" * 60)

# Initialize dictionaries
all_metrics = {'R2': {}, 'MAE': {}, 'RMSE': {}}
all_feature_importances = {}
top_features_for_reduced = {wl: {} for wl in WATER_LEVELS_TO_PROCESS}
full_models_temp = {wl: {} for wl in WATER_LEVELS_TO_PROCESS}

# Flag to check if any metric was successfully calculated
any_metric_calculated = False

# Loop through water levels
for wl in WATER_LEVELS_TO_PROCESS:
    print(f"\n--- Processing: Water Level = {wl} ml ---")
    wl_key = water_level_keys[wl]
    for metric in all_metrics: all_metrics[metric][wl_key] = {} # Initialize WL key
    all_feature_importances[wl_key] = {}

    # Filter data
    train_indices = X_train['Water_Level'] == wl
    test_indices = X_test['Water_Level'] == wl
    X_train_wl = X_train.loc[train_indices, features_for_per_level_model].copy()
    y_train_wl = y_train.loc[train_indices].copy()
    X_test_wl = X_test.loc[test_indices, features_for_per_level_model].copy()
    y_test_wl = y_test.loc[test_indices].copy()

    # Check data sufficiency
    if X_train_wl.shape[0] < MIN_TRAIN_SAMPLES or X_test_wl.shape[0] < MIN_TEST_SAMPLES:
        print(f"  Skipping WL {wl}ml: Insufficient data (Train: {X_train_wl.shape[0]}, Test: {X_test_wl.shape[0]})")
        for target_orig in original_target_cols:
             target_key = target_mapping[target_orig]
             for metric in all_metrics: all_metrics[metric][wl_key][target_key] = None
             all_feature_importances[wl_key][target_key] = []
             top_features_for_reduced[wl][target_orig] = []
        continue

    # Ensure Categorical Type
    try:
        X_train_wl['Soil_Code'] = pd.Categorical(X_train_wl['Soil_Code'], categories=train_soil_code_categories, ordered=False)
        X_test_wl['Soil_Code'] = pd.Categorical(X_test_wl['Soil_Code'], categories=train_soil_code_categories, ordered=False)
        if X_test_wl['Soil_Code'].isnull().any(): print("Warning: NaNs in test Soil_Code after category apply.")
    except Exception as e: print(f"Error applying category for WL {wl}: {e}"); continue

    # Loop through targets
    for target_orig in original_target_cols:
        target_key = target_mapping[target_orig]
        print(f"\n  --- Target: {target_orig} (Key: {target_key}) (WL: {wl}ml) ---")

        # Reset metrics for this target before trying
        r2_reduced, mae_reduced, rmse_reduced = np.nan, np.nan, np.nan

        # Check target existence
        if target_orig not in y_train_wl.columns or target_orig not in y_test_wl.columns:
            print(f"    Skipping: Target '{target_orig}' not found."); status_final = 'Skip_Missing'
        # Check for Constant Target
        elif y_train_wl[target_orig].nunique() <= 1:
            val = y_train_wl[target_orig].iloc[0] if not y_train_wl[target_orig].empty else 'N/A'
            print(f"    Skipping: Target '{target_orig}' constant in train (Value: {val})."); status_final = 'Skip_Constant'
            if wl == 0 and target_orig in ['Nitro', 'Posh Nitro', 'Pota Nitro'] and val == 0:
                 mae_reduced = 0.0; rmse_reduced = 0.0 # Special case for MAE/RMSE
        else:
             status_final = 'Processing' # Mark as processing
             y_train_target_wl = y_train_wl[target_orig]
             y_test_target_wl = y_test_wl[target_orig]

             # --- Train FULL model ---
             print(f"    Training FULL model...")
             lgbm_full = lgb.LGBMRegressor(random_state=42, verbose=-1)
             current_full_model = None
             try:
                 lgbm_full.fit(X_train_wl, y_train_target_wl, categorical_feature=['Soil_Code'])
                 current_full_model = lgbm_full
                 full_models_temp[wl][target_orig] = current_full_model
                 print(f"    Full model training complete.")
             except Exception as e:
                 print(f"    ERROR during FULL model training: {e}"); status_final = 'Error_Train_Full'
                 current_full_model = None # Ensure no model proceeds

             # --- Get Importance (if full model trained) ---
             importances_list = []
             top_n_spectral_features = []
             if current_full_model:
                 try:
                     importances = current_full_model.booster_.feature_importance(importance_type='gain')
                     feature_names = current_full_model.feature_name_
                     if len(importances) != len(feature_names): raise ValueError("Importance/feature name mismatch")

                     imp_df = pd.DataFrame({'feature': feature_names, 'importance': importances})
                     spec_imp = imp_df[imp_df['feature'].isin(spectral_cols) & (imp_df['importance'] > 0)].sort_values('importance', ascending=False)
                     importances_list = spec_imp[['feature', 'importance']].to_dict('records')
                     top_n_spectral_features = spec_imp['feature'].head(N_TOP_FEATURES).tolist()

                     if not top_n_spectral_features:
                         print(f"    Warning: No spectral features with positive gain found.")
                         status_final = 'Skip_No_Importance'
                     else:
                         print(f"    Top {len(top_n_spectral_features)} spectral features: {top_n_spectral_features}")

                 except Exception as e:
                     print(f"    ERROR getting feature importance: {e}"); status_final = 'Error_Importance'
                     top_n_spectral_features = [] # Ensure list is empty on error
             else:
                 status_final = 'Skip_No_Full_Model' # Update status if full model failed

             # --- Store importance regardless of success ---
             all_feature_importances[wl_key][target_key] = importances_list
             top_features_for_reduced[wl][target_orig] = top_n_spectral_features

             # --- Process REDUCED model (only if top features found) ---
             if status_final == 'Processing' and top_n_spectral_features: # Check status and features
                 features_for_reduced = ['Soil_Code'] + top_n_spectral_features
                 X_train_wl_reduced = X_train_wl[features_for_reduced].copy()
                 X_test_wl_reduced = X_test_wl[features_for_reduced].copy()

                 # Train Reduced Model
                 print(f"    Training REDUCED model...")
                 lgbm_reduced = lgb.LGBMRegressor(random_state=42, verbose=-1)
                 current_reduced_model = None
                 try:
                     lgbm_reduced.fit(X_train_wl_reduced, y_train_target_wl, categorical_feature=['Soil_Code'])
                     current_reduced_model = lgbm_reduced
                     print("    Reduced model training complete.")

                     # Evaluate Reduced Model
                     print(f"    Evaluating reduced model...")
                     y_pred_reduced = current_reduced_model.predict(X_test_wl_reduced)
                     if y_test_target_wl.nunique() <= 1:
                         print(f"    Warning: Target constant in test set (reduced). R2 is NaN.")
                         r2_reduced = np.nan
                     else:
                         r2_reduced = r2_score(y_test_target_wl, y_pred_reduced)
                     mae_reduced = mean_absolute_error(y_test_target_wl, y_pred_reduced)
                     rmse_reduced = np.sqrt(mean_squared_error(y_test_target_wl, y_pred_reduced))

                     # *** Mark metric calculation success ***
                     any_metric_calculated = True
                     status_final = 'Success_Reduced'
                     print(f"      Eval Metrics (Reduced): R2={r2_reduced:.4f}, MAE={mae_reduced:.4f}, RMSE={rmse_reduced:.4f}")

                     # Save the Reduced Model
                     safe_target_name = "".join(c if c.isalnum() else "_" for c in target_key)
                     model_filename = os.path.join(MODEL_SAVE_DIR_REDUCED, f"model_reduced_{safe_target_name}_WL{wl}ml_top{N_TOP_FEATURES}.joblib")
                     try: joblib.dump(current_reduced_model, model_filename); print(f"    Saved reduced model: {model_filename}")
                     except Exception as e: print(f"    ERROR saving reduced model: {e}")

                 except Exception as e:
                     print(f"    ERROR during reduced model train/eval: {e}"); status_final = 'Error_Reduced'
                     # Ensure metrics remain NaN if eval failed
                     r2_reduced, mae_reduced, rmse_reduced = np.nan, np.nan, np.nan

             elif status_final == 'Processing' and not top_n_spectral_features:
                 # Handle case where full model trained but no importance found
                 print(f"    Skipping reduced model: No important spectral features.")
                 status_final = 'Skip_No_Importance'

        # --- Store Metrics for Backend ---
        # Convert NaNs to None for JSON compatibility right before storing
        final_r2 = r2_reduced if not np.isnan(r2_reduced) else None
        final_mae = mae_reduced if not np.isnan(mae_reduced) else None
        final_rmse = rmse_reduced if not np.isnan(rmse_reduced) else None

        all_metrics['R2'][wl_key][target_key] = final_r2
        all_metrics['MAE'][wl_key][target_key] = final_mae
        all_metrics['RMSE'][wl_key][target_key] = final_rmse
        print(f"    Stored Metrics: R2={final_r2}, MAE={final_mae}, RMSE={final_rmse} (Status: {status_final})")


# ==============================================================================
#                        SAVE BACKEND DATA FILES
# ==============================================================================
print("\n" + "=" * 60)
print("--- Saving Data for Backend ---")

# --- Save Metrics ---
metrics_filepath = os.path.join(BACKEND_DATA_DIR, "metrics.json")
print(f"\nAttempting to save metrics to: {metrics_filepath}")
print(f"any_metric_calculated = {any_metric_calculated}")
print("Content of all_metrics dictionary:")
pprint.pprint(all_metrics) # Print the dictionary content for inspection
print("-" * 20)

# Check if the dictionary structure seems valid before saving
if not isinstance(all_metrics, dict) or not all_metrics.get('R2') or not all_metrics.get('MAE') or not all_metrics.get('RMSE'):
     print("ERROR: 'all_metrics' dictionary has unexpected structure or is missing keys. Skipping metrics save.")
else:
    try:
        # Use a custom handler for numpy types if needed, although None conversion should be main part
        # The json.loads(json.dumps(...)) trick is generally good for numpy->python types
        # cleaned_metrics = json.loads(json.dumps(all_metrics)) # No ignore_nan needed as we convert above
        # Let's try direct dump first, as values should be None or float/int now
        with open(metrics_filepath, 'w') as f:
            json.dump(all_metrics, f, indent=4)
        print(f"Successfully saved performance metrics to '{metrics_filepath}'")
    except TypeError as e:
        print(f"ERROR saving metrics JSON due to TypeError: {e}")
        print("This often means non-serializable types (like NumPy specifics) remain.")
        print("Consider adding a more robust custom JSON encoder if this persists.")
        traceback.print_exc()
    except Exception as e:
        print(f"ERROR saving metrics JSON: {e}")
        traceback.print_exc()


# --- Save Feature Importances ---
importance_filepath = os.path.join(BACKEND_DATA_DIR, "feature_importance.json")
print(f"\nAttempting to save importances to: {importance_filepath}")
try:
    # Convert NaN importance scores to None
    cleaned_importances = {}
    for wl_key, targets in all_feature_importances.items():
        cleaned_importances[wl_key] = {}
        for target_key, imp_list in targets.items():
             if isinstance(imp_list, list): # Ensure it's a list
                 cleaned_importances[wl_key][target_key] = [
                     {'feature': imp.get('feature', 'Error'),
                      'importance': float(imp['importance']) if isinstance(imp.get('importance'), (int, float)) and not np.isnan(imp['importance']) else None}
                     for imp in imp_list if isinstance(imp, dict) # Check item is dict
                 ]
             else:
                  print(f"Warning: Importance data for {target_key}@{wl_key} was not a list, skipping.")
                  cleaned_importances[wl_key][target_key] = [] # Save empty list

    with open(importance_filepath, 'w') as f:
        json.dump(cleaned_importances, f, indent=4)
    print(f"Saved feature importances to '{importance_filepath}'")
except Exception as e:
    print(f"ERROR saving feature importance JSON: {e}")
    traceback.print_exc()

# --- Save Top Features Used ---
top_features_filepath = os.path.join(BACKEND_DATA_DIR, "top_features_used.json")
print(f"\nAttempting to save top features used to: {top_features_filepath}")
try:
    top_features_for_json = {}
    for wl_num, targets in top_features_for_reduced.items():
        wl_key = water_level_keys[wl_num]
        top_features_for_json[wl_key] = {}
        for target_orig, features in targets.items():
             target_key = target_mapping[target_orig]
             top_features_for_json[wl_key][target_key] = features # features should be a list of strings

    with open(top_features_filepath, 'w') as f:
        json.dump(top_features_for_json, f, indent=4)
    print(f"Saved top features used to '{top_features_filepath}'")
except Exception as e:
    print(f"ERROR saving top features JSON: {e}")
    traceback.print_exc()


# ==============================================================================
#                            RESULTS SUMMARY (Console)
# ==============================================================================
# (Console summary - no changes needed here)
print("\n" + "=" * 60)
print("              Reduced Model Performance Summary (Console)")
print("=" * 60)
# ... (rest of the summary printing code) ...


print("\n" + "=" * 60)
print("                   SCRIPT FINISHED (Backend Prep)")
print("=" * 60)