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

const METRIC_PARAMETERS = [
    'Capacity Moist', 'Temperature', 'Moisture', 'Electrical Conductivity', 'pH', 'Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'
];
const METRIC_PARAM_KEYS = {
    'Capacity Moist': 'capacityMoist', 'Temperature': 'temperature',
    'Moisture': 'moisture', 'Electrical Conductivity': 'electricalConductivity',
    'pH': 'pH', 'Nitrogen (N)': 'nitro',
    'Phosphorus (P)': 'phosphorus', 'Potassium (K)': 'potassium'
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
  const [selectedTopXAttribute, setSelectedTopXAttribute] = useState(METRIC_PARAM_KEYS['pH']); // Default to 'pH'
  const [rankedWavelengthsData, setRankedWavelengthsData] = useState([]);
  const [topXError, setTopXError] = useState(null);
  const [isLoadingTopX, setIsLoadingTopX] = useState(false);
  const [currentView, setCurrentView] = useState('form');
  const [selectedMetricType, setSelectedMetricType] = useState('MAE');
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
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        setMetricsData(data);
      } catch (err) {
        console.error("Failed to load metrics:", err);
        setMetricsError(`Could not load metrics: ${err.message}.`);
        setMetricsData(null);
      } finally {
        setIsLoadingMetrics(false);
      }
    };
    fetchMetrics();
  }, []);

  // Update Wavelength Rows on Count Change
  useEffect(() => {
    if (numWavelengthInputs !== dynamicWavelengthData.length && !isNaN(numWavelengthInputs) && numWavelengthInputs >= MIN_WAVELENGTH_INPUTS) {
        setDynamicWavelengthData(initializeWavelengthRows(numWavelengthInputs));
    }
  }, [numWavelengthInputs]); // Removed dynamicWavelengthData.length dependency to prevent loop

  // Fetch Top Wavelengths
  const fetchTopWavelengths = useCallback(async () => {
    if (!selectedTopXAttribute) return;
    setIsLoadingTopX(true);
    setTopXError(null);
    const url = `${API_BASE_URL}/top-wavelengths?attribute=${selectedTopXAttribute}&count=${topXCount}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP error ${response.status}`);
      }
      const data = await response.json();
      setRankedWavelengthsData(data || []);
    } catch (err) {
      console.error("Failed top wavelengths:", err);
      setTopXError(`Could not load rankings: ${err.message}.`);
      setRankedWavelengthsData([]);
    } finally {
      setIsLoadingTopX(false);
    }
  }, [selectedTopXAttribute, topXCount]);

  useEffect(() => {
    fetchTopWavelengths();
  }, [fetchTopWavelengths]);

  // --- Event Handlers ---
  const handleNumWavelengthChange = (e) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
         setNumWavelengthInputs(''); // Allow clearing the input
         return;
    }
    let count = parseInt(rawValue, 10);
    if (!isNaN(count)) {
       // Clamp value within limits only if it's a valid number
       count = Math.max(MIN_WAVELENGTH_INPUTS, Math.min(MAX_WAVELENGTH_INPUTS, count));
       setNumWavelengthInputs(count);
    } else {
        // If input is not a number (e.g., text), potentially keep the old value or clear
        // Keeping old value might be less confusing than clearing
         setNumWavelengthInputs(numWavelengthInputs); // Or setNumWavelengthInputs('')
    }
};

  const handleNumWavelengthBlur = (e) => {
    let count = parseInt(e.target.value, 10);
    if (isNaN(count) || count < MIN_WAVELENGTH_INPUTS) {
      setNumWavelengthInputs(MIN_WAVELENGTH_INPUTS);
    } else if (count > MAX_WAVELENGTH_INPUTS) {
      setNumWavelengthInputs(MAX_WAVELENGTH_INPUTS);
    }
  };

  const handleDynamicWavelengthChange = (id, selectedWavelength) => {
    setDynamicWavelengthData(prevData =>
      prevData.map(row => (row.id === id ? { ...row, wavelength: selectedWavelength } : row))
    );
  };

  const handleDynamicValueChange = (id, newValue) => {
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
     if (!isNaN(count)){
         count = Math.max(MIN_TOP_X, Math.min(MAX_TOP_X, count));
         setTopXCount(count);
     } else {
          setTopXCount(topXCount); // Keep old value if invalid input
     }
  };

  const handleTopXCountBlur = (e) => {
    let count = parseInt(e.target.value, 10);
    if (isNaN(count) || count < MIN_TOP_X) {
      setTopXCount(MIN_TOP_X);
    } else if (count > MAX_TOP_X) {
      setTopXCount(MAX_TOP_X);
    }
  };

  const getSelectedWavelengths = useMemo(() => {
    // console.log("Recalculating selected wavelengths"); // Less verbose
    return dynamicWavelengthData.map(row => row.wavelength).filter(wl => wl !== '');
  }, [dynamicWavelengthData]);


  const handleSubmit = async (event) => {
    event.preventDefault();
    setAnalysisError(null);
    setIsAnalyzing(true);
    setSubmitted(false);
    setAnalysisData(null);

    // --- Frontend Validation ---
    // 1. Check Water Level
    if (!waterLevel || isNaN(parseFloat(waterLevel))) {
        setAnalysisError('Please enter a valid numerical water level (e.g., 0, 25, 50).');
        setIsAnalyzing(false);
        return;
    }
    const parsedWaterLevel = parseFloat(waterLevel);

    // 2. Check Wavelength Inputs
    const filledRows = dynamicWavelengthData.filter(row => row.wavelength && row.value.trim() !== '');
    if (filledRows.length < MIN_WAVELENGTH_INPUTS) {
      // **IMPROVED ERROR MESSAGE**
      setAnalysisError(`Please ensure at least ${MIN_WAVELENGTH_INPUTS} rows have both a unique wavelength selected and a numerical absorbance value entered.`);
      setIsAnalyzing(false);
      return;
    }

    const wavelengthPayload = {};
    let hasInvalidValue = false;
    let invalidDetail = ''; // More specific info

    filledRows.forEach(row => {
      const parsedValue = parseFloat(row.value);
      if (isNaN(parsedValue)) {
        hasInvalidValue = true;
        invalidDetail = `Invalid value entered for wavelength ${row.wavelength || '?'}`;
      } else if (wavelengthPayload[row.wavelength]) { // Check for duplicate wavelength selections
          hasInvalidValue = true;
          invalidDetail = `Duplicate wavelength selected: ${row.wavelength}`;
      } else {
        wavelengthPayload[row.wavelength] = parsedValue;
      }
    });

    if (hasInvalidValue) {
      setAnalysisError(`Input error: ${invalidDetail}. Please correct the absorbance values and ensure wavelengths are unique.`);
      setIsAnalyzing(false);
      return;
    }
    // --- End Frontend Validation ---

    const payload = {
      waterLevel: parsedWaterLevel, // Send validated number
      wavelengths: wavelengthPayload, // Send validated dictionary
    };

    console.log("Sending analysis payload:", JSON.stringify(payload));

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });

      const responseBody = await response.text(); // Get raw response text first
      console.log("Raw analysis response:", responseBody);

      if (!response.ok) {
         let errorMsg = `Analysis request failed: ${response.status}`;
         try { const errorData = JSON.parse(responseBody); errorMsg = errorData?.error || errorMsg; }
         catch (e) { /* Ignore if parsing fails, use status code */ }
         throw new Error(errorMsg);
      }

      // Try parsing JSON only if response is OK
      let receivedData;
      try { receivedData = JSON.parse(responseBody); }
      catch (e) { throw new Error("Received invalid JSON response from server."); }

      console.log("Received analysis data:", receivedData);

      // Basic check if data is an object (backend ensures keys now)
       if (!receivedData || typeof receivedData !== 'object') {
           throw new Error("Received unexpected analysis data format.");
       }

      setAnalysisData(receivedData);
      setSubmitted(true);
      setAnalysisError(null);
      setCurrentView('form');

      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

    } catch (error) {
      console.error("Error submitting analysis:", error);
      setAnalysisError(`Analysis failed: ${error.message}. Check inputs or backend logs.`);
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
       if (submitted && analysisData) { setTimeout(() => { outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); }
       else { window.scrollTo(0, 0); }
  };


  // --- Inline CSS ---
  const hideNumberInputArrows = `input[type='number']::-webkit-outer-spin-button, input[type='number']::-webkit-inner-spin-button {-webkit-appearance: none; margin: 0;} input[type='number'] {-moz-appearance: textfield;}`;

  // --- Render Logic ---

  // Metrics View
  const renderMetricsView = () => {
    if (isLoadingMetrics) return (/* Loading Skeleton - No change */ <div className="w-full max-w-6xl mx-auto mt-10 mb-20 text-center"><button onClick={handleBackToForm} className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700">← Back</button><div className="bg-white p-8 rounded-xl shadow-lg animate-pulse"><div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-6"></div><div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div><div className="space-y-4"><div className="h-10 bg-gray-200 rounded"></div><div className="h-10 bg-gray-200 rounded"></div><div className="h-10 bg-gray-200 rounded"></div></div></div></div> );
    if (metricsError || !metricsData) return (/* Error Display - No change */ <div className="w-full max-w-6xl mx-auto mt-10 mb-20 text-center"><button onClick={handleBackToForm} className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700">← Back</button><div className="bg-white p-8 rounded-xl shadow-lg border border-red-200"><h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Metrics</h1><p className="mt-4 text-gray-700">{metricsError || "Metrics data unavailable."}</p></div></div> );

    const getRankBgClass = (rank) => { if (rank === 1) return 'bg-yellow-100/60 hover:bg-yellow-200/70'; if (rank === 2) return 'bg-gray-200/60 hover:bg-gray-300/70'; if (rank === 3) return 'bg-orange-100/60 hover:bg-orange-200/70'; return 'bg-white hover:bg-gray-50'; };

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
             {/* Info Card */}
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-100 z-10 whitespace-nowrap shadow-sm">Water Content</th>
                            {METRIC_PARAMETERS.map(param => ( <th key={param} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{param}</th> ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {SIMULATED_WATER_LEVELS_KEYS.map(levelKey => (
                            <tr key={levelKey} className="hover:bg-gray-50 transition-colors duration-150">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 sticky left-0 bg-white hover:bg-gray-50 z-10 shadow-sm">{levelKey}</td>
                                {METRIC_PARAMETERS.map(param => {
                                    const paramKey = METRIC_PARAM_KEYS[param];
                                    const value = metricsData?.[selectedMetricType]?.[levelKey]?.[paramKey];
                                    let displayValue = 'N/A';
                                    // Use === null check because 0 is a valid metric
                                    if (value !== undefined && value !== null) {
                                        displayValue = typeof value === 'number' ? value.toFixed(selectedMetricType === 'R2' ? 3 : 2) : value;
                                    }
                                    return ( <td key={`${levelKey}-${paramKey}`} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center"><div className="transform transition duration-150 hover:scale-110 inline-block px-1">{displayValue}</div></td> );
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
             <p className="text-sm text-gray-600 mb-6 -mt-4">Most influential wavelengths for predicting the selected attribute (based on 25ml model analysis). Lower rank = higher importance.</p>
             {/* Controls for Top X */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="topx-attribute" className="block text-base font-medium text-gray-700 mb-2">Select Attribute:</label>
                    <select id="topx-attribute" value={selectedTopXAttribute} onChange={(e) => setSelectedTopXAttribute(e.target.value)} className="block w-full px-4 py-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150">
                        {METRIC_PARAMETERS.map(param => ( <option key={METRIC_PARAM_KEYS[param]} value={METRIC_PARAM_KEYS[param]}>{param}</option> ))}
                    </select>
                </div>
                 <div className="w-full sm:w-auto">
                    <label htmlFor="topx-count" className="block text-base font-medium text-gray-700 mb-2">Show Top:</label>
                    <input id="topx-count" type="number" value={topXCount} onChange={handleTopXCountChange} onBlur={handleTopXCountBlur} min={MIN_TOP_X} max={MAX_TOP_X} required className="block w-full sm:w-28 px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150" placeholder={`(${MIN_TOP_X}-${MAX_TOP_X})`} />
                </div>
            </div>
             {/* Loading/Error/Table for Top X */}
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
                            ) : ( <tr><td colSpan="3" className="text-center py-4 text-gray-500">No ranking data.</td></tr> )}
                        </tbody>
                    </table>
                </div>
              )}
          </div> {/* End Top Wavelengths Card */}
        </div> // End Metrics View Container
      );
  };

  // Form and Output View
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
                  const selectedInOtherRows = getSelectedWavelengths.filter(wl => wl !== row.wavelength);
                  const availableWavelengths = ALL_WAVELENGTHS.filter(wl => !selectedInOtherRows.includes(wl));
                  return (
                    <div key={row.id} className="grid grid-cols-2 gap-3 items-center">
                      {/* Wavelength Select */}
                      <div>
                        <label htmlFor={`wavelength-select-${row.id}`} className="sr-only">Wavelength {index + 1}</label>
                        <select id={`wavelength-select-${row.id}`} value={row.wavelength} onChange={(e) => handleDynamicWavelengthChange(row.id, e.target.value)} required className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white transition duration-150">
                          <option value="" disabled>Select Wavelength...</option>
                           {row.wavelength && !availableWavelengths.includes(row.wavelength) && ( <option key={row.wavelength} value={row.wavelength}>{row.wavelength} nm</option> )}
                          {availableWavelengths.map(wl => (<option key={wl} value={wl}>{wl} nm</option>))}
                        </select>
                      </div>
                      {/* Absorbance Input */}
                      <div>
                        <label htmlFor={`wavelength-value-${row.id}`} className="sr-only">Value for {row.wavelength || `Wavelength ${index + 1}`}</label>
                        <input id={`wavelength-value-${row.id}`} type="text" inputMode="decimal" value={row.value} onChange={(e) => handleDynamicValueChange(row.id, e.target.value)} required disabled={!row.wavelength} className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition duration-150 ${!row.wavelength ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white'}`} placeholder="Absorbance" />
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
                        {METRIC_PARAMETERS.map(paramName => {
                            const key = METRIC_PARAM_KEYS[paramName];
                            const value = analysisData[key]; // Direct access
                            const unitMap = { temperature: '°C', moisture: '%', electricalConductivity: 'dS/m', nitro: 'mg/kg', phosphorus: 'mg/kg', potassium: 'mg/kg', capacityMoist: '%'}; // Added Cap Moist unit
                            const unit = unitMap[key] || '';
                            // Display N/A if value is null/undefined, otherwise format
                            const displayValue = (value === null || value === undefined) ? "N/A" : value; // Backend now formats numbers

                            return (
                                <tr key={key} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{paramName}</td>
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
                    {/* Helper to render indicator cards */}
                    {Object.entries(analysisData) // Iterate over results
                        .filter(([key]) => ['pH', 'nitro', 'potassium', 'phosphorus', 'moisture', 'electricalConductivity', 'temperature', 'capacityMoist'].includes(key)) // Filter for displayable keys
                        .map(([key, value]) => {
                            if (value === null || value === undefined) return null; // Don't render card if value is N/A

                            let label = key;
                            let unit = '';
                            let bgColor = 'bg-gray-50 border-gray-200'; // Default
                            let interpretation = '';

                            // Find the display name from METRIC_PARAMETERS
                            const paramEntry = Object.entries(METRIC_PARAM_KEYS).find(([name, k]) => k === key);
                            label = paramEntry ? paramEntry[0] : key; // Use display name or key

                            // Apply specific styles/units/interpretations
                            switch (key) {
                                case 'pH':
                                    const phVal = parseFloat(value);
                                    bgColor = phVal < 6 ? 'bg-orange-50 border-orange-200' : phVal > 7.5 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
                                    interpretation = phVal < 6 ? 'Acidic' : phVal > 7.5 ? 'Alkaline' : 'Neutral';
                                    break;
                                case 'nitro': unit = 'mg/kg'; bgColor = 'bg-yellow-50 border-yellow-200'; break;
                                case 'potassium': unit = 'mg/kg'; bgColor = 'bg-red-50 border-red-200'; break;
                                case 'phosphorus': unit = 'mg/kg'; bgColor = 'bg-purple-50 border-purple-200'; break;
                                case 'moisture': unit = '%'; bgColor = 'bg-cyan-50 border-cyan-200'; break;
                                case 'capacityMoist': unit = '%'; bgColor = 'bg-sky-50 border-sky-200'; break; // Added styling
                                case 'electricalConductivity': unit = 'dS/m'; bgColor = 'bg-lime-50 border-lime-200'; break;
                                case 'temperature': unit = '°C'; bgColor = 'bg-rose-50 border-rose-200'; break; // Added styling
                                default: break;
                            }

                            return (
                                <div key={key} className={`p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 ${bgColor}`}>
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
       <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        ${hideNumberInputArrows}
         th.sticky, td.sticky { position: sticky; left: 0; z-index: 10; }
         thead th.sticky { z-index: 20; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1); }
         tbody td.sticky { box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1); }
         thead th.sticky:first-child { box-shadow: none; }
      `}</style>
      {currentView === 'form' ? renderFormView() : renderMetricsView()}
    </div>
  );
}

export default HomePage;