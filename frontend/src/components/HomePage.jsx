// frontend/src/pages/HomePage.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- Constants ---
const API_BASE_URL = 'http://localhost:5000/api'; // Backend URL

const ALL_WAVELENGTHS = [
  '410', '435', '460', '485', '510', '535', '560', '585',
  '610', '645', '680', '705', '730', '760', '810', '860',
  '900', '940'
];
const MIN_WAVELENGTH_INPUTS = 3;
const MAX_WAVELENGTH_INPUTS = ALL_WAVELENGTHS.length;
const MIN_TOP_X = 3;
const MAX_TOP_X = ALL_WAVELENGTHS.length;

// Display names for the UI
const METRIC_PARAMETERS = [
    'Capacity Moist', 'Temperature', 'Moisture', 'Electrical Conductivity', 'pH', 'Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'
];

// Mapping from UI display names to frontend internal keys (used for TopX selection, analysis results display)
const METRIC_PARAM_KEYS_FRONTEND = {
    'Capacity Moist': 'capacityMoist', 'Temperature': 'temperature',
    'Moisture': 'moisture', 'Electrical Conductivity': 'electricalConductivity',
    'pH': 'pH', 'Nitrogen (N)': 'nitro',
    'Phosphorus (P)': 'phosphorus', 'Potassium (K)': 'potassium'
};

// Mapping from UI display names to *backend* keys (used for accessing metrics data)
const METRIC_PARAM_KEYS_BACKEND = {
    'Capacity Moist': 'Capacitity Moist', // Note the typo from your model
    'Temperature': 'Temp',
    'Moisture': 'Moist',
    'Electrical Conductivity': 'EC',
    'pH': 'Ph', // Note the capitalization from your model
    'Nitrogen (N)': 'Nitro',
    'Phosphorus (P)': 'Posh Nitro',
    'Potassium (K)': 'Pota Nitro'
};


const SIMULATED_WATER_LEVELS_KEYS = ['0ml', '25ml', '50ml'];

function HomePage() {
  // --- State ---
  const [waterLevel, setWaterLevel] = useState('');
  const [numWavelengthInputs, setNumWavelengthInputs] = useState(MIN_WAVELENGTH_INPUTS);
  const [dynamicWavelengthData, setDynamicWavelengthData] = useState(
    () => initializeWavelengthRows(MIN_WAVELENGTH_INPUTS)
  );
  const [submitted, setSubmitted] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metricsData, setMetricsData] = useState(null);
  const [metricsError, setMetricsError] = useState(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [topXCount, setTopXCount] = useState(MIN_TOP_X);
  // Use frontend key for TopX attribute selection state
  const [selectedTopXAttribute, setSelectedTopXAttribute] = useState(METRIC_PARAM_KEYS_FRONTEND['pH']);
  const [rankedWavelengthsData, setRankedWavelengthsData] = useState([]);
  const [topXError, setTopXError] = useState(null);
  const [isLoadingTopX, setIsLoadingTopX] = useState(false);
  const [currentView, setCurrentView] = useState('form');
  const [selectedMetricType, setSelectedMetricType] = useState('MAE'); // Default metric type
  const outputRef = useRef(null);

  // --- Helper Functions ---
  function initializeWavelengthRows(count) {
    return Array.from({ length: count }, () => ({
      id: uuidv4(), wavelength: '', value: '',
    }));
  }

  // --- Effects ---
  // Fetch Metrics on Mount
  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoadingMetrics(true);
      setMetricsError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/metrics`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})); // Try to parse error JSON
          throw new Error(errorData?.error || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched Metrics Data:", data); // <<< Log fetched data
        setMetricsData(data); // Store the data exactly as received
      } catch (err) {
        console.error("Failed to load metrics:", err);
        setMetricsError(`Could not load metrics: ${err.message}. Check backend connection and logs.`);
        setMetricsData(null);
      } finally {
        setIsLoadingMetrics(false);
      }
    };
    fetchMetrics();
  }, []);

  // Update Wavelength Rows on Count Change
  useEffect(() => {
    const desiredCount = parseInt(numWavelengthInputs, 10);
    if (!isNaN(desiredCount) && desiredCount >= MIN_WAVELENGTH_INPUTS && desiredCount !== dynamicWavelengthData.length) {
        // Adjust rows: add new or remove excess
        if (desiredCount > dynamicWavelengthData.length) {
            const newRows = Array.from({ length: desiredCount - dynamicWavelengthData.length }, () => ({
                id: uuidv4(), wavelength: '', value: ''
            }));
            setDynamicWavelengthData(prevData => [...prevData, ...newRows]);
        } else {
            setDynamicWavelengthData(prevData => prevData.slice(0, desiredCount));
        }
    }
   }, [numWavelengthInputs]); // Only depends on the count input

  // Fetch Top Wavelengths
  const fetchTopWavelengths = useCallback(async () => {
    // selectedTopXAttribute holds the *frontend* key (e.g., 'pH')
    if (!selectedTopXAttribute) return;
    setIsLoadingTopX(true);
    setTopXError(null);
    // Send the frontend key to the backend endpoint
    const url = `${API_BASE_URL}/top-wavelengths?attribute=${selectedTopXAttribute}&count=${topXCount}`;
    console.log("Fetching Top Wavelengths URL:", url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP error ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched Top Wavelengths:", data);
      setRankedWavelengthsData(data || []); // Handle potentially empty array from backend
    } catch (err) {
      console.error("Failed top wavelengths:", err);
      setTopXError(`Could not load rankings: ${err.message}.`);
      setRankedWavelengthsData([]);
    } finally {
      setIsLoadingTopX(false);
    }
  }, [selectedTopXAttribute, topXCount]); // Dependencies are correct

  useEffect(() => {
    fetchTopWavelengths();
  }, [fetchTopWavelengths]); // fetchTopWavelengths is memoized, so this runs when its dependencies change

  // --- Event Handlers ---
  const handleNumWavelengthChange = (e) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
         setNumWavelengthInputs(''); // Allow clearing
         // Optionally reset rows here or let the useEffect handle it
         return;
    }
    // Allow inputting numbers freely, clamping happens on blur or in useEffect
    setNumWavelengthInputs(rawValue);
};

  const handleNumWavelengthBlur = (e) => {
      let count = parseInt(e.target.value, 10);
      if (isNaN(count) || count < MIN_WAVELENGTH_INPUTS) {
        setNumWavelengthInputs(MIN_WAVELENGTH_INPUTS);
      } else if (count > MAX_WAVELENGTH_INPUTS) {
        setNumWavelengthInputs(MAX_WAVELENGTH_INPUTS);
      } else {
        // If it's within range, ensure the state reflects the integer value
        setNumWavelengthInputs(count);
      }
  };


  const handleDynamicWavelengthChange = (id, selectedWavelength) => {
    setDynamicWavelengthData(prevData =>
      prevData.map(row => (row.id === id ? { ...row, wavelength: selectedWavelength } : row))
    );
  };

  const handleDynamicValueChange = (id, newValue) => {
    // Allow empty string, or numbers (positive/negative, decimals)
    if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
      setDynamicWavelengthData(prevData =>
        prevData.map(row => (row.id === id ? { ...row, value: newValue } : row))
      );
    }
  };

  const handleTopXCountChange = (e) => {
    const rawValue = e.target.value;
     if (rawValue === '') {
        setTopXCount(''); return;
    }
     let count = parseInt(rawValue, 10);
     // Allow typing, clamp on blur or fetch
     if (!isNaN(count)) {
         // Optionally clamp immediately, or just update state
         setTopXCount(count);
     } else {
          // Handle non-numeric input if needed (e.g., clear or keep old)
          setTopXCount(topXCount); // Keep old value for now
     }
  };

  const handleTopXCountBlur = (e) => {
    let count = parseInt(e.target.value, 10);
    if (isNaN(count) || count < MIN_TOP_X) {
      setTopXCount(MIN_TOP_X);
    } else if (count > MAX_TOP_X) {
      setTopXCount(MAX_TOP_X);
    }
    // No need to call fetchTopWavelengths here, the useEffect handles it
  };

  // Memoize the calculation of currently selected wavelengths for dropdown filtering
  const getSelectedWavelengths = useMemo(() => {
    return dynamicWavelengthData.map(row => row.wavelength).filter(Boolean); // Filter out empty strings
  }, [dynamicWavelengthData]);


  const handleSubmit = async (event) => {
    event.preventDefault();
    setAnalysisError(null);
    setIsAnalyzing(true);
    setSubmitted(false); // Reset submission status
    setAnalysisData(null); // Clear previous results

    // --- Frontend Validation ---
    let isValid = true;
    let errorMsg = '';

    // 1. Check Water Level
    const parsedWaterLevel = parseFloat(waterLevel);
    if (isNaN(parsedWaterLevel)) {
        errorMsg = 'Please enter a valid numerical water level (e.g., 0, 25, 50).';
        isValid = false;
    }
    // Optionally check if it's one of the allowed levels if needed by the model strictly
    // else if (![0, 25, 50].includes(parsedWaterLevel)) {
    //     errorMsg = 'Water level must be 0, 25, or 50.';
    //     isValid = false;
    // }

    // 2. Check Wavelength Inputs (if validation passed so far)
    const filledRows = dynamicWavelengthData.filter(row => row.wavelength && row.value.trim() !== '');
    const wavelengthPayload = {};
    const selectedWls = new Set(); // To check for duplicates

    if (isValid && filledRows.length < MIN_WAVELENGTH_INPUTS) {
      errorMsg = `Please provide at least ${MIN_WAVELENGTH_INPUTS} valid wavelength readings.`;
      isValid = false;
    } else if (isValid) {
        for (const row of filledRows) {
            const parsedValue = parseFloat(row.value);
            if (isNaN(parsedValue)) {
                errorMsg = `Invalid numerical value entered for wavelength ${row.wavelength}.`;
                isValid = false;
                break;
            }
            if (selectedWls.has(row.wavelength)) {
                 errorMsg = `Duplicate wavelength selected: ${row.wavelength}. Please ensure all selected wavelengths are unique.`;
                 isValid = false;
                 break;
            }
            wavelengthPayload[row.wavelength] = parsedValue;
            selectedWls.add(row.wavelength);
        }
    }

    if (!isValid) {
        setAnalysisError(errorMsg);
        setIsAnalyzing(false);
        return;
    }
    // --- End Frontend Validation ---

    const payload = {
      waterLevel: parsedWaterLevel,
      wavelengths: wavelengthPayload,
    };

    console.log("Sending analysis payload:", JSON.stringify(payload));

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();
      console.log("Raw analysis response:", responseBody);

      if (!response.ok) {
         let apiErrorMsg = `Analysis request failed: ${response.status}`;
         try {
             const errorData = JSON.parse(responseBody);
             apiErrorMsg = errorData?.error || apiErrorMsg; // Use backend error if available
         } catch (e) { /* Ignore JSON parse error if body wasn't JSON */ }
         throw new Error(apiErrorMsg);
      }

      // Parse JSON only if response is OK
      let receivedData;
      try {
          receivedData = JSON.parse(responseBody);
      } catch (e) {
          throw new Error("Received invalid JSON response from server.");
      }

      console.log("Received analysis data:", receivedData);

      // Basic check if data is an object
       if (!receivedData || typeof receivedData !== 'object') {
           throw new Error("Received unexpected analysis data format.");
       }

      setAnalysisData(receivedData); // Store backend response (should have frontend keys)
      setSubmitted(true);
      setAnalysisError(null); // Clear any previous errors
      setCurrentView('form'); // Stay on form view to show results below

      // Scroll to results after a short delay
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

    } catch (error) {
      console.error("Error submitting analysis:", error);
      setAnalysisError(`Analysis failed: ${error.message}.`);
      setSubmitted(false);
      setAnalysisData(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // View Switching Handlers
  const handleViewMetrics = () => { if (!isLoadingMetrics) { setCurrentView('metrics'); window.scrollTo(0, 0); } };
  const handleBackToForm = () => {
      setCurrentView('form');
       // If results exist, scroll to them after switching back
       if (submitted && analysisData) {
           setTimeout(() => { outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
       } else {
           window.scrollTo(0, 0); // Otherwise scroll to top
       }
  };


  // --- Inline CSS (No changes needed here) ---
  const hideNumberInputArrows = `input[type='number']::-webkit-outer-spin-button, input[type='number']::-webkit-inner-spin-button {-webkit-appearance: none; margin: 0;} input[type='number'] {-moz-appearance: textfield;}`;

  // --- Render Logic ---

  // Metrics View
  const renderMetricsView = () => {
    // Loading Skeleton - No change
    if (isLoadingMetrics) return ( <div className="w-full max-w-6xl mx-auto mt-10 mb-20 text-center"><button onClick={handleBackToForm} className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700">← Back</button><div className="bg-white p-8 rounded-xl shadow-lg animate-pulse"><div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-6"></div><div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div><div className="space-y-4"><div className="h-10 bg-gray-200 rounded"></div><div className="h-10 bg-gray-200 rounded"></div><div className="h-10 bg-gray-200 rounded"></div></div></div></div> );
    // Error Display - No change
    if (metricsError || !metricsData) return ( <div className="w-full max-w-6xl mx-auto mt-10 mb-20 text-center"><button onClick={handleBackToForm} className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700">← Back</button><div className="bg-white p-8 rounded-xl shadow-lg border border-red-200"><h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Metrics</h1><p className="mt-4 text-gray-700">{metricsError || "Metrics data unavailable."}</p></div></div> );

    const getRankBgClass = (rank) => { if (rank === 1) return 'bg-yellow-100/60 hover:bg-yellow-200/70'; if (rank === 2) return 'bg-gray-200/60 hover:bg-gray-300/70'; if (rank === 3) return 'bg-orange-100/60 hover:bg-orange-200/70'; return 'bg-white hover:bg-gray-50'; };

     console.log("Rendering Metrics Table. Data:", metricsData); // Log data used for rendering
     console.log("Selected Metric Type:", selectedMetricType); // Log selected type

    return (
        <div className="w-full max-w-6xl mx-auto mt-10 mb-20 space-y-8">
           <button onClick={handleBackToForm} className="mb-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">← Back to Analysis</button>
          {/* Main Metrics Card */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Model Performance Metrics</h1>
            {/* Metric Type Selector */}
             <div className="mb-4 max-w-xs">
                <label htmlFor="metric-type" className="block text-sm font-medium text-gray-700 mb-1">Select Metric:</label>
                 <select id="metric-type" value={selectedMetricType} onChange={(e) => setSelectedMetricType(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                     <option value="MAE">MAE (Lower is better)</option>
                     <option value="RMSE">RMSE (Lower is better)</option>
                     <option value="R2">R² Score (Higher is better)</option>
                 </select>
             </div>
             {/* Info Card - No change */}
             <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 shadow-sm">
                 <p><strong>MAE:</strong> Mean Absolute Error. Average prediction error magnitude.</p>
                 <p><strong>RMSE:</strong> Root Mean Squared Error. Error magnitude, penalizes large errors more.</p>
                 <p><strong>R²:</strong> Coefficient of Determination. Proportion of variance explained (0 to 1).</p>
            </div>

            {/* --- Metrics Table --- */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            {/* Sticky Header */}
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-100 z-10 whitespace-nowrap shadow-sm">Water Content</th>
                            {/* Map UI display names for headers */}
                            {METRIC_PARAMETERS.map(paramDisplayName => (
                                <th key={paramDisplayName} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{paramDisplayName}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {SIMULATED_WATER_LEVELS_KEYS.map(levelKey => ( // e.g., "0ml"
                            <tr key={levelKey} className="hover:bg-gray-50 transition-colors duration-150">
                                {/* Sticky Cell */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 sticky left-0 bg-white hover:bg-gray-50 z-10 shadow-sm">{levelKey}</td>
                                {/* Map UI display names again to get the correct backend key */}
                                {METRIC_PARAMETERS.map(paramDisplayName => {
                                    // Find the corresponding BACKEND key needed to access the metricsData object
                                    const backendKey = METRIC_PARAM_KEYS_BACKEND[paramDisplayName];

                                    // Access data using the selected metric type, water level key, and BACKEND key
                                    const value = metricsData?.[selectedMetricType]?.[levelKey]?.[backendKey];

                                    // --- Detailed Logging for this specific cell ---
                                    // const accessPath = `${selectedMetricType}.${levelKey}.${backendKey}`;
                                    // console.log(`Accessing: ${accessPath} -> Value:`, value, typeof value);
                                    // ---

                                    let displayValue = 'N/A';
                                    // Check if value is a valid number (0 is valid)
                                    if (typeof value === 'number' && !isNaN(value)) {
                                        displayValue = value.toFixed(selectedMetricType === 'R2' ? 3 : 2); // Format R2 differently
                                    } else if (value !== undefined && value !== null) {
                                        displayValue = String(value); // Display other non-null values as string
                                    }

                                    return (
                                        <td key={`${levelKey}-${backendKey}`} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                                            <div className="transform transition duration-150 hover:scale-110 inline-block px-1">{displayValue}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* End Metrics Table */}
          </div>
          {/* End Main Metrics Card */}

          {/* Top Wavelengths Card */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
             <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">Top Wavelength Importance</h2>
             <p className="text-sm text-gray-600 mb-6 -mt-4">Most influential wavelengths for predicting the selected attribute. Lower rank = higher importance.</p>
             {/* Controls for Top X */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="topx-attribute" className="block text-base font-medium text-gray-700 mb-2">Select Attribute:</label>
                    {/* Dropdown shows UI names, value is the frontend key */}
                    <select
                        id="topx-attribute"
                        value={selectedTopXAttribute} // State holds the frontend key ('pH', 'nitro', etc.)
                        onChange={(e) => setSelectedTopXAttribute(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150"
                    >
                        {METRIC_PARAMETERS.map(paramDisplayName => (
                            <option key={METRIC_PARAM_KEYS_FRONTEND[paramDisplayName]} value={METRIC_PARAM_KEYS_FRONTEND[paramDisplayName]}>
                                {paramDisplayName}
                            </option>
                         ))}
                    </select>
                </div>
                 <div className="w-full sm:w-auto">
                    <label htmlFor="topx-count" className="block text-base font-medium text-gray-700 mb-2">Show Top:</label>
                    <input id="topx-count" type="number" value={topXCount} onChange={handleTopXCountChange} onBlur={handleTopXCountBlur} min={MIN_TOP_X} max={MAX_TOP_X} required className="block w-full sm:w-28 px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150" placeholder={`(${MIN_TOP_X}-${MAX_TOP_X})`} />
                </div>
            </div>
             {/* Loading/Error/Table for Top X - No change needed here */}
             {isLoadingTopX && ( <div className="text-center py-4 text-gray-500 animate-pulse">Loading...</div> )}
             {topXError && !isLoadingTopX && ( <div className="text-center py-4 text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{topXError}</div> )}
             {!isLoadingTopX && !topXError && (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Wavelength (nm)</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider" title="Model Importance Score">Importance</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {rankedWavelengthsData.length > 0 ? (
                                rankedWavelengthsData.map(item => (
                                <tr key={item.rank} className={`${getRankBgClass(item.rank)} transition-colors`}>
                                    <td className="px-6 py-3 text-sm font-medium text-gray-900 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${item.rank <= 3 ? 'text-black' : 'text-gray-700'}`}>{item.rank}</span></td>
                                    <td className="px-6 py-3 text-sm text-gray-800 text-center">{item.wavelength}</td>
                                    <td className="px-6 py-3 text-sm text-gray-600 text-center">{item.importanceScore !== undefined && item.importanceScore !== null ? item.importanceScore.toFixed(4) : 'N/A'}</td>
                                </tr>
                                ))
                            ) : ( <tr><td colSpan="3" className="text-center py-4 text-gray-500">No ranking data available.</td></tr> )}
                        </tbody>
                    </table>
                </div>
              )}
          </div> {/* End Top Wavelengths Card */}
        </div> // End Metrics View Container
      );
  };

  // Form and Output View (No changes needed in this part for the metrics table fix)
  const renderFormView = () => (
    <>
      {/* --- Input Card --- */}
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-4xl text-center mb-8 hover:shadow-xl transition-shadow duration-300">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-800">Soil Spectrometer Analyzer</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 xl:gap-x-8 gap-y-6">
            {/* Column 1: Water Level & Wavelength Count */}
            <div className="space-y-6">
              {/* Water Level */}
              <div>
                <label htmlFor="water-level" className="block text-base font-medium text-gray-700 mb-2 text-left">Water Level (ml)</label>
                <input id="water-level" type="number" value={waterLevel} onChange={(e) => setWaterLevel(e.target.value)} required className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition duration-150" placeholder="e.g., 0, 25, 50" step="any" />
              </div>
              {/* Wavelength Count */}
              <div>
                <label htmlFor="num-wavelengths" className="block text-base font-medium text-gray-700 mb-2 text-left">Number of Wavelength Readings</label>
                <input id="num-wavelengths" type="number" value={numWavelengthInputs} onChange={handleNumWavelengthChange} onBlur={handleNumWavelengthBlur} min={MIN_WAVELENGTH_INPUTS} max={MAX_WAVELENGTH_INPUTS} required className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition duration-150" placeholder={`(${MIN_WAVELENGTH_INPUTS}-${MAX_WAVELENGTH_INPUTS})`} />
                <p className="text-xs text-gray-500 mt-1 text-left">Min {MIN_WAVELENGTH_INPUTS} wavelengths needed overall.</p>
              </div>
            </div>

            {/* Column 2: Dynamic Wavelength Inputs */}
            <div className="xl:col-span-1">
              <h2 className="text-lg md:text-xl font-semibold mb-3 text-left">Spectrometer Data (Absorbance)</h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 -mr-2 border border-gray-200 rounded-md p-4 bg-gray-50/50 shadow-inner">
                 {/* Wavelength Rows */}
                {dynamicWavelengthData.map((row, index) => {
                  // Filter out wavelengths already selected in *other* rows
                  const selectedInOtherRows = getSelectedWavelengths.filter(wl => wl !== row.wavelength);
                  const availableWavelengths = ALL_WAVELENGTHS.filter(wl => !selectedInOtherRows.includes(wl));
                  return (
                    <div key={row.id} className="grid grid-cols-2 gap-3 items-center">
                      {/* Wavelength Select */}
                      <div>
                        <label htmlFor={`wavelength-select-${row.id}`} className="sr-only">Wavelength {index + 1}</label>
                        <select
                            id={`wavelength-select-${row.id}`}
                            value={row.wavelength}
                            onChange={(e) => handleDynamicWavelengthChange(row.id, e.target.value)}
                            required
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white transition duration-150"
                        >
                          <option value="" disabled>Select Wavelength...</option>
                          {/* If current row has a selection, ensure it's in the list even if temporarily duplicated during selection change */}
                          {row.wavelength && !availableWavelengths.includes(row.wavelength) && (
                               <option key={row.wavelength} value={row.wavelength}>{row.wavelength} nm</option>
                           )}
                           {/* List available wavelengths */}
                          {availableWavelengths.map(wl => (<option key={wl} value={wl}>{wl} nm</option>))}
                        </select>
                      </div>
                      {/* Absorbance Input */}
                      <div>
                        <label htmlFor={`wavelength-value-${row.id}`} className="sr-only">Value for {row.wavelength || `Wavelength ${index + 1}`}</label>
                        <input
                            id={`wavelength-value-${row.id}`}
                            type="text" // Use text for more flexible input, validation handles format
                            inputMode="decimal" // Hint for mobile keyboards
                            value={row.value}
                            onChange={(e) => handleDynamicValueChange(row.id, e.target.value)}
                            required
                            disabled={!row.wavelength} // Disable if no wavelength selected
                            className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition duration-150 ${!row.wavelength ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white'}`}
                            placeholder="Absorbance"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-left">*Select unique wavelengths and enter absorbance values.</p>
            </div>
          </div>

          {/* Error Display */}
          {analysisError && ( <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm text-left">{analysisError}</div> )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button type="submit" disabled={isAnalyzing || isLoadingMetrics} className={`w-full sm:w-auto flex-grow px-6 py-3 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-base transform hover:scale-105 ${isAnalyzing || isLoadingMetrics ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze Soil Data'}
              </button>
              <button type="button" onClick={handleViewMetrics} disabled={isAnalyzing || isLoadingMetrics} className={`w-full sm:w-auto px-6 py-3 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-base transform hover:scale-105 ${ isAnalyzing || isLoadingMetrics ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`} title={isLoadingMetrics ? "Metrics loading..." : "View performance metrics"}>
                 {isLoadingMetrics ? 'Loading...' : 'View Performance'}
               </button>
          </div>
        </form>
      </div>

      {/* --- Output Section --- */}
      {submitted && analysisData && !isAnalyzing && (
        <div ref={outputRef} className="mt-8 w-full max-w-4xl space-y-8 md:max-w-6xl animate-fade-in">
           {/* Results Table */}
           <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Soil Analysis Results</h2>
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Attribute</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Predicted Value</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {/* Iterate using UI display names */}
                        {METRIC_PARAMETERS.map(paramDisplayName => {
                            // Get the frontend key used in the analysisData object
                            const frontendKey = METRIC_PARAM_KEYS_FRONTEND[paramDisplayName];
                            const value = analysisData[frontendKey]; // Access using frontend key

                            // Define units based on frontend key
                            const unitMap = { temperature: '°C', moisture: '%', electricalConductivity: 'dS/m', nitro: 'mg/kg', phosphorus: 'mg/kg', potassium: 'mg/kg', capacityMoist: '%'};
                            const unit = unitMap[frontendKey] || '';

                            // Display N/A if value is null/undefined, otherwise use the value
                            const displayValue = (value === null || value === undefined) ? "N/A" : value;

                            return (
                                <tr key={frontendKey} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{paramDisplayName}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {/* Only add unit if displayValue is not N/A */}
                                    {displayValue !== 'N/A' ? `${displayValue}${unit ? ` ${unit}` : ''}` : 'N/A'}
                                </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>

          {/* Key Indicators Dashboard */}
           <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Key Indicators</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    {/* Iterate over analysisData which uses frontend keys */}
                    {Object.entries(analysisData)
                        // Filter for keys we want to display as indicators
                        .filter(([key]) => ['pH', 'nitro', 'potassium', 'phosphorus', 'moisture', 'electricalConductivity', 'temperature', 'capacityMoist'].includes(key))
                        .map(([frontendKey, value]) => {
                            if (value === null || value === undefined) return null; // Don't render card if value is N/A

                            // Find the UI display name corresponding to the frontendKey
                            const paramEntry = Object.entries(METRIC_PARAM_KEYS_FRONTEND).find(([name, k]) => k === frontendKey);
                            const label = paramEntry ? paramEntry[0] : frontendKey; // Use display name or key as fallback

                            let unit = '';
                            let bgColor = 'bg-gray-50 border-gray-200';
                            let interpretation = '';

                            // Apply specific styles/units/interpretations based on frontendKey
                            switch (frontendKey) {
                                case 'pH':
                                    const phVal = parseFloat(value);
                                    if (!isNaN(phVal)) {
                                      bgColor = phVal < 6 ? 'bg-orange-50 border-orange-200' : phVal > 7.5 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
                                      interpretation = phVal < 6 ? 'Acidic' : phVal > 7.5 ? 'Alkaline' : 'Neutral';
                                    }
                                    break;
                                case 'nitro': unit = 'mg/kg'; bgColor = 'bg-yellow-50 border-yellow-200'; break;
                                case 'potassium': unit = 'mg/kg'; bgColor = 'bg-red-50 border-red-200'; break;
                                case 'phosphorus': unit = 'mg/kg'; bgColor = 'bg-purple-50 border-purple-200'; break;
                                case 'moisture': unit = '%'; bgColor = 'bg-cyan-50 border-cyan-200'; break;
                                case 'capacityMoist': unit = '%'; bgColor = 'bg-sky-50 border-sky-200'; break;
                                case 'electricalConductivity': unit = 'dS/m'; bgColor = 'bg-lime-50 border-lime-200'; break;
                                case 'temperature': unit = '°C'; bgColor = 'bg-rose-50 border-rose-200'; break;
                                default: break;
                            }

                            return (
                                <div key={frontendKey} className={`p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 ${bgColor}`}>
                                    <h3 className="text-sm md:text-base font-semibold text-gray-700 truncate" title={label}>{label}</h3>
                                    <p className="text-lg md:text-xl font-bold text-gray-900">{value}{unit ? <span className="text-sm font-normal"> {unit}</span> : ''}</p>
                                    {interpretation && <p className="text-xs text-gray-600">{interpretation}</p>}
                                </div>
                            );
                     })}
                </div>
            </div>
        </div>
      )}
    </>
  );

  // Main Return
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4 pt-10 pb-20">
       {/* Style tag is fine, warnings are often ignorable if styled-jsx works */}
       <style jsx="true" global="true">{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        ${hideNumberInputArrows}
         th.sticky, td.sticky { position: sticky; left: 0; z-index: 10; }
         thead th.sticky { z-index: 20; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1); }
         tbody td.sticky { box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1); }
         /* Ensure sticky background is opaque */
         thead th.sticky:first-child { background-color: #f9fafb; /* bg-gray-100 */ }
         tbody td.sticky:first-child { background-color: #ffffff; /* bg-white */ }
         tr:hover td.sticky:first-child { background-color: #f9fafb; /* bg-gray-50 on hover */ }

      `}</style>
      {currentView === 'form' ? renderFormView() : renderMetricsView()}
    </div>
  );
}

export default HomePage;