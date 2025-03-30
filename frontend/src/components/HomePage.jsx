// frontend/src/pages/HomePage.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid'; // For unique keys in dynamic rows

// Define the full list of possible wavelengths
const ALL_WAVELENGTHS = [
  '410', '435', '460', '485', '510', '535', '560', '585',
  '610', '645', '680', '705', '730', '760', '810', '860',
  '900', '940'
];
const MIN_WAVELENGTH_INPUTS = 3;
const MAX_WAVELENGTH_INPUTS = ALL_WAVELENGTHS.length;
const MIN_TOP_X = 3;
const MAX_TOP_X = ALL_WAVELENGTHS.length; // Max possible rank is the total number of wavelengths

// Define parameters for the metrics table header
const METRIC_PARAMETERS = [
    'Capacity Moist', 'Temperature', 'Moisture', 'Electrical Conductivity', 'pH', 'Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'
];
const METRIC_PARAM_KEYS = { // Map display names to potential data keys
    'Capacity Moist': 'capacityMoist',
    'Temperature': 'temperature',
    'Moisture': 'moisture',
    'Electrical Conductivity': 'electricalConductivity',
    'pH': 'pH',
    'Nitrogen (N)': 'nitro',
    'Phosphorus (P)': 'phosphorus',
    'Potassium (K)': 'potassium'
};
const SIMULATED_WATER_LEVELS = ['0ml', '25ml', '50ml'];

// Basic Fisher-Yates shuffle for randomizing wavelengths
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
};


function HomePage() {
  // --- State ---
  const [waterLevel, setWaterLevel] = useState('');
  const [numWavelengthInputs, setNumWavelengthInputs] = useState(MIN_WAVELENGTH_INPUTS);
  const [dynamicWavelengthData, setDynamicWavelengthData] = useState(
    () => initializeWavelengthRows(MIN_WAVELENGTH_INPUTS)
  );
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState(null); // Holds main analysis results
  const [metricsData, setMetricsData] = useState(null); // Holds generated metrics table data
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // View Management State
  const [currentView, setCurrentView] = useState('form'); // 'form' or 'metrics'
  const [selectedMetricType, setSelectedMetricType] = useState('MAE'); // Default metric

  // State for Top X Wavelengths section
  const [topXCount, setTopXCount] = useState(MIN_TOP_X);
  const [selectedTopXAttribute, setSelectedTopXAttribute] = useState(METRIC_PARAM_KEYS[METRIC_PARAMETERS[0]]); // Default to first attribute key

  const outputRef = useRef(null); // Ref for scrolling on form view

  // --- Helper Functions ---

  function initializeWavelengthRows(count) {
    return Array.from({ length: count }, () => ({
      id: uuidv4(), wavelength: '', value: '',
    }));
  }

  // Generate or fetch metrics data on component mount
  useEffect(() => {
    console.log("Initializing metrics data...");
    // Simulate fetching persistent metrics data from backend
    const initialMetrics = generateDummyMetricsData();
    setMetricsData(initialMetrics);

    // In a real app, you would fetch this:
    // fetch('/api/metrics') // Assuming an endpoint exists
    //   .then(res => {
    //     if (!res.ok) throw new Error('Failed to fetch metrics');
    //     return res.json();
    //   })
    //   .then(data => setMetricsData(data))
    //   .catch(err => {
    //     console.error("Failed to load initial metrics:", err);
    //     setError("Could not load performance metrics data.");
    //     setMetricsData(generateDummyMetricsData()); // Fallback to dummy on error? Or show error state.
    //   });
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    if (numWavelengthInputs !== dynamicWavelengthData.length) {
      setDynamicWavelengthData(initializeWavelengthRows(numWavelengthInputs));
    }
  }, [numWavelengthInputs, dynamicWavelengthData.length]); // Added dynamicWavelengthData.length dependency

  // Function to generate dummy metrics data (replace with actual logic/API call if needed)
  const generateDummyMetricsData = () => {
    const metrics = { MAE: {}, RMSE: {}, R2: {} };
    const paramKeys = Object.values(METRIC_PARAM_KEYS);

    SIMULATED_WATER_LEVELS.forEach(level => {
        metrics.MAE[level] = {};
        metrics.RMSE[level] = {};
        metrics.R2[level] = {};
        paramKeys.forEach(paramKey => {
            metrics.MAE[level][paramKey] = (Math.random() * 5 + 0.5).toFixed(2); // Example MAE values
            metrics.RMSE[level][paramKey] = (Math.random() * 7 + 1).toFixed(2); // Example RMSE values
            metrics.R2[level][paramKey] = (Math.random() * 0.3 + 0.65).toFixed(3); // Example R2 values (0.65-0.95)
        });
    });
    console.log("Generated Dummy Metrics:", metrics); // Debugging
    return metrics;
  };


  // --- Event Handlers ---

  const handleNumWavelengthChange = (e) => {
    let count = parseInt(e.target.value, 10);
    count = isNaN(count) ? MIN_WAVELENGTH_INPUTS : Math.max(MIN_WAVELENGTH_INPUTS, Math.min(MAX_WAVELENGTH_INPUTS, count));
    setNumWavelengthInputs(count);
  };

  const handleDynamicWavelengthChange = (id, selectedWavelength) => {
    setDynamicWavelengthData(prevData =>
      prevData.map(row => (row.id === id ? { ...row, wavelength: selectedWavelength } : row))
    );
  };

  const handleDynamicValueChange = (id, newValue) => {
    setDynamicWavelengthData(prevData =>
      prevData.map(row => (row.id === id ? { ...row, value: newValue } : row))
    );
  };

   const handleTopXCountChange = (e) => {
    let count = parseInt(e.target.value, 10);
    count = isNaN(count) ? MIN_TOP_X : Math.max(MIN_TOP_X, Math.min(MAX_TOP_X, count));
    setTopXCount(count);
  };

  const getSelectedWavelengths = useMemo(() => {
    return dynamicWavelengthData.map(row => row.wavelength).filter(wl => wl !== '');
  }, [dynamicWavelengthData]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    setSubmitted(false); // Reset submission status for *this* analysis
    setData(null);       // Clear previous *analysis* results

    // We DO NOT clear metricsData here as it's considered persistent/independent

    const wavelengthPayload = dynamicWavelengthData.reduce((acc, row) => {
      if (row.wavelength && row.value.trim() !== '') {
        // Ensure value is treated as number, default to 0 if parsing fails
        const parsedValue = parseFloat(row.value);
        acc[row.wavelength] = isNaN(parsedValue) ? 0 : parsedValue;
      }
      return acc;
    }, {});


    if (Object.keys(wavelengthPayload).length < MIN_WAVELENGTH_INPUTS) {
      setError(`Please select and provide valid numerical values for at least ${MIN_WAVELENGTH_INPUTS} wavelengths.`);
      setIsLoading(false);
      return;
    }
     // Validate all provided values are numbers
     const invalidValueEntry = dynamicWavelengthData.find(row => row.wavelength && isNaN(parseFloat(row.value)));
     if (invalidValueEntry) {
         setError(`Please ensure all provided absorbance values are valid numbers. Check wavelength ${invalidValueEntry.wavelength}.`);
         setIsLoading(false);
         return;
     }


    const payload = {
      waterLevel: parseFloat(waterLevel) || 0, // Default to 0 if invalid
      wavelengths: wavelengthPayload,
    };

    console.log("Sending data to backend:", payload);

    // SIMULATE API CALL (Replace with actual fetch)
    new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate success or failure
            if (Math.random() > 0.1) { // Simulate 90% success rate
                 // Use generateDummyData for main results for now
                 const generatedMainData = generateDummyData();
                 // Backend returns *only* main results here.
                 resolve(generatedMainData);
            } else {
                 reject(new Error("Simulated API Error: Analysis failed."));
            }
        }, 1500); // Simulate network delay
    })
    .then(receivedData => {
      console.log("Received analysis data (simulated):", receivedData);
      setData(receivedData); // Set main analysis results
      // Metrics data is already loaded/generated via useEffect
      setSubmitted(true); // Mark analysis as successfully submitted
      setError(null);
      setCurrentView('form'); // Stay on form view to show results first
      // Scroll to output section on the form view
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    })
    .catch(error => {
      console.error("Error submitting data (simulated):", error);
      setError(`Analysis failed: ${error.message}.`);
      setSubmitted(false); // Indicate analysis failure
    })
    .finally(() => {
        setIsLoading(false);
    });

    // // --- ACTUAL FETCH (Commented out for simulation) ---
    // fetch('/api/analyze', { /* ... fetch options ... */ })
    // .then(async response => { /* ... handle response ... */ })
    // .then(receivedAnalysisData => { // Only analysis data expected
    //   setData(receivedAnalysisData);
    //   // Metrics should be fetched separately or already exist
    //   setSubmitted(true);
    //   setError(null);
    //   setCurrentView('form');
    //   setTimeout(() => { /* scroll */ }, 100);
    // })
    // .catch(error => { /* ... handle error ... */ })
    // .finally(() => setIsLoading(false));
    // // --- End Actual Fetch ---

  };

  // Placeholder for main data generation (remove stats from here)
  const generateDummyData = () => {
    console.warn("Using dummy data for main analysis results.");
    return {
      capacityMoist: 30 + Math.floor(Math.random() * 10),
      temperature: 22 + Math.floor(Math.random() * 8),
      moisture: 35 + Math.floor(Math.random() * 15),
      electricalConductivity: (1.0 + Math.random()).toFixed(1),
      pH: (6.0 + Math.random()).toFixed(1),
      nitro: 15 + Math.floor(Math.random() * 10),
      phosphorus: 10 + Math.floor(Math.random() * 10),
      potassium: 20 + Math.floor(Math.random() * 10),
      recommendedCrops: [
        { name: 'Wheat', match: 80 + Math.floor(Math.random() * 10), image: '/images/wheat.jpg' },
        { name: 'Corn', match: 70 + Math.floor(Math.random() * 10), image: '/images/corn.jpg' },
        { name: 'Rice', match: 55 + Math.floor(Math.random() * 10), image: '/images/rice.jpg' }
      ]
    };
  };

  // Switch to metrics view
  const handleViewMetrics = () => {
      if (metricsData) { // Check if metrics data is available
          setCurrentView('metrics');
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
          // This case should be less likely now with useEffect loading
          setError("Performance metrics are currently unavailable. Please try again later.");
      }
  };

  // Switch back to form view
  const handleBackToForm = () => {
      setCurrentView('form');
       // Optional: Scroll back to results if they exist from a previous analysis
       if (submitted && data) {
           setTimeout(() => {
               outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
           }, 100);
       }
  };

  // Generate ranked wavelengths list based on state
   const rankedWavelengths = useMemo(() => {
    // In a real scenario, this data would come from the backend based on
    // feature importance analysis for the selected 'selectedTopXAttribute'.
    // For now, we just shuffle ALL_WAVELENGTHS and take the top X.
    console.log(`Generating top ${topXCount} wavelengths for ${selectedTopXAttribute} (randomized)`); // Debug
    const shuffled = shuffleArray([...ALL_WAVELENGTHS]);
    const count = Math.max(MIN_TOP_X, Math.min(MAX_TOP_X, topXCount)); // Ensure count is within bounds

    // Simulating ranked data - replace with actual logic later
    return shuffled.slice(0, count).map((wl, index) => ({
      rank: index + 1,
      wavelength: wl,
      // importanceScore: Math.random().toFixed(4) // Placeholder for a real score
    }));
  }, [topXCount, selectedTopXAttribute]); // Recompute when X or attribute changes


  // --- Inline CSS ---
  const hideNumberInputArrows = `
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  `;

  // --- Render Logic ---

  // Render Metrics View Content
  const renderMetricsView = () => {
    if (!metricsData) {
        return (
           <div className="w-full max-w-6xl mx-auto mt-10 mb-20 text-center">
             <button
                 onClick={handleBackToForm}
                 className="mb-6 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
             >
                 ← Back to Analysis
             </button>
             <div className="bg-white p-8 rounded-xl shadow-lg">
                 <h1 className="text-2xl font-bold text-red-600">Error</h1>
                 <p className="mt-4 text-gray-700">{error || "Performance metrics data is not available."}</p>
             </div>
           </div>
        );
    }

    const getRankBgClass = (rank) => {
        if (rank === 1) return 'bg-yellow-100/60 hover:bg-yellow-200/70'; // Gold-ish tint
        if (rank === 2) return 'bg-gray-200/60 hover:bg-gray-300/70';   // Silver-ish tint
        if (rank === 3) return 'bg-orange-100/60 hover:bg-orange-200/70'; // Bronze-ish tint
        return 'bg-white hover:bg-gray-50'; // Default + hover
    };


    return (
        <div className="w-full max-w-6xl mx-auto mt-10 mb-20 space-y-8">
           <button
             onClick={handleBackToForm}
             className="mb-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
           >
             ← Back to Analysis
           </button>

          {/* Main Metrics Card */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg transform transition duration-300 hover:scale-[1.01] hover:shadow-xl">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Model Performance Metrics</h1>

            {/* Metric Type Selector */}
            <div className="mb-4 max-w-xs">
               <label htmlFor="metric-type" className="block text-base font-medium text-gray-700 mb-2">
                   Select Metric:
               </label>
               <select
                 id="metric-type"
                 value={selectedMetricType}
                 onChange={(e) => setSelectedMetricType(e.target.value)}
                 className="block w-full px-4 py-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150 ease-in-out"
               >
                 <option value="MAE">Mean Absolute Error (MAE)</option>
                 <option value="RMSE">Root Mean Squared Error (RMSE)</option>
                 <option value="R2">R² Score</option>
               </select>
            </div>

             {/* Info card */}
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 shadow-sm">
                <p>
                    {selectedMetricType === 'MAE' && <><span className="font-semibold">Lower</span> MAE values indicate better model accuracy.</>}
                    {selectedMetricType === 'RMSE' && <><span className="font-semibold">Lower</span> RMSE values indicate better model accuracy (penalizes large errors more).</>}
                    {selectedMetricType === 'R2' && <>R² Score values closer to <span className="font-semibold">1</span> indicate a better model fit.</>}
                </p>
            </div>


            {/* Metrics Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-100 z-10 whitespace-nowrap">Water Content</th>
                            {METRIC_PARAMETERS.map(param => (
                                <th key={param} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                    {param}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {SIMULATED_WATER_LEVELS.map(level => (
                            <tr key={level} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 sticky left-0 bg-white hover:bg-gray-50 z-10">{level}</td>
                                {METRIC_PARAMETERS.map(param => {
                                    const paramKey = METRIC_PARAM_KEYS[param];
                                    // Safely access nested data
                                    const value = metricsData?.[selectedMetricType]?.[level]?.[paramKey] ?? 'N/A';
                                    return (
                                        <td key={`${level}-${param}`} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                                            <div className="transform transition duration-150 hover:scale-110 inline-block px-1">
                                                {value}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>

          {/* Top Wavelengths Card */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg transform transition duration-300 hover:scale-[1.01] hover:shadow-xl">
             <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">Top Wavelength Importance</h2>
             <p className="text-sm text-gray-600 mb-6 -mt-4">Shows the most influential wavelengths for predicting the selected attribute based on model analysis (currently randomized). Lower rank means higher importance.</p>

             {/* Controls for Top X */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                 {/* Attribute Selector */}
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="topx-attribute" className="block text-base font-medium text-gray-700 mb-2">
                        Select Attribute:
                    </label>
                    <select
                        id="topx-attribute"
                        value={selectedTopXAttribute}
                        onChange={(e) => setSelectedTopXAttribute(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150 ease-in-out"
                    >
                        {METRIC_PARAMETERS.map(param => (
                            <option key={METRIC_PARAM_KEYS[param]} value={METRIC_PARAM_KEYS[param]}>
                                {param}
                            </option>
                        ))}
                    </select>
                </div>
                 {/* Number of Wavelengths (X) Input */}
                 <div className="w-full sm:w-auto">
                    <label htmlFor="topx-count" className="block text-base font-medium text-gray-700 mb-2">
                        Show Top:
                    </label>
                    <input
                        id="topx-count"
                        type="number"
                        value={topXCount}
                        onChange={handleTopXCountChange}
                        min={MIN_TOP_X}
                        max={MAX_TOP_X}
                        required
                        className="block w-full sm:w-28 px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base transition duration-150 ease-in-out"
                        placeholder={`(${MIN_TOP_X}-${MAX_TOP_X})`}
                    />
                </div>
            </div>


             {/* Ranked Wavelengths Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Wavelength</th>
                            {/* Optional: Add Importance Score later */}
                            {/* <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Importance</th> */}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {rankedWavelengths.map(item => (
                            <tr key={item.rank} className={`${getRankBgClass(item.rank)} transition-colors duration-150 ease-in-out`}>
                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${item.rank <= 3 ? 'text-black' : 'text-gray-700'}`}>
                                      {item.rank}
                                    </span>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-800 text-center">{item.wavelength} nm</td>
                                {/* Optional: Score cell */}
                                {/* <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 text-center">{item.importanceScore}</td> */}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {rankedWavelengths.length === 0 && (
                     <p className="text-center py-4 text-gray-500">No ranking data available.</p>
                 )}
            </div>

          </div> {/* End Top Wavelengths Card */}

        </div> // End Metrics View Container
      );
  };

  // Render Form and Output View Content
  const renderFormView = () => (
    <>
      {/* --- Input Card --- */}
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-4xl text-center mb-8 transform transition duration-300 hover:scale-[1.01] hover:shadow-xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-800">Soil Spectrometer Analyzer</h1>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Input Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 xl:gap-x-8 gap-y-6">
            {/* Column 1: Water Level & Wavelength Count */}
            <div className="space-y-6">
              {/* Water Level */}
              <div>
                <label htmlFor="water-level" className="block text-base font-medium text-gray-700 mb-2 text-left">Water Level (ml)</label>
                <input id="water-level" type="number" value={waterLevel} onChange={(e) => setWaterLevel(e.target.value)} required className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition duration-150 ease-in-out" placeholder="Enter water level in ml" step="any" />
              </div>
              {/* Wavelength Count */}
              <div>
                <label htmlFor="num-wavelengths" className="block text-base font-medium text-gray-700 mb-2 text-left">Number of Wavelength Readings</label>
                <input id="num-wavelengths" type="number" value={numWavelengthInputs} onChange={handleNumWavelengthChange} min={MIN_WAVELENGTH_INPUTS} max={MAX_WAVELENGTH_INPUTS} required className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition duration-150 ease-in-out" placeholder={`Enter a number (${MIN_WAVELENGTH_INPUTS}-${MAX_WAVELENGTH_INPUTS})`} />
                <p className="text-xs text-gray-500 mt-1 text-left">Select how many different wavelength absorbance values you will provide (min {MIN_WAVELENGTH_INPUTS}).</p>
              </div>
            </div>
            {/* Column 2: Dynamic Wavelength Inputs */}
            <div className="xl:col-span-1">
              <h2 className="text-lg md:text-xl font-semibold mb-3 text-left">Spectrometer Data (Absorbance)</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 border border-gray-200 rounded-md p-4 bg-gray-50/50 shadow-inner">
                {dynamicWavelengthData.map((row, index) => {
                  const selectedInOtherRows = getSelectedWavelengths.filter(wl => wl !== row.wavelength);
                  const availableWavelengths = ALL_WAVELENGTHS.filter(wl => !selectedInOtherRows.includes(wl));
                  return (
                    <div key={row.id} className="grid grid-cols-2 gap-3 items-center transition-opacity duration-150 ease-in-out">
                      {/* Wavelength Select */}
                      <div>
                        <label htmlFor={`wavelength-select-${row.id}`} className="sr-only">Wavelength {index + 1}</label>
                        <select id={`wavelength-select-${row.id}`} value={row.wavelength} onChange={(e) => handleDynamicWavelengthChange(row.id, e.target.value)} required className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white transition duration-150 ease-in-out">
                          <option value="" disabled>Select Wavelength...</option>
                          {availableWavelengths.map(wl => (<option key={wl} value={wl}>{wl} nm</option>))}
                        </select>
                      </div>
                      {/* Absorbance Input */}
                      <div>
                        <label htmlFor={`wavelength-value-${row.id}`} className="sr-only">Value for {row.wavelength || `Wavelength ${index + 1}`}</label>
                        <input id={`wavelength-value-${row.id}`} type="number" value={row.value} onChange={(e) => handleDynamicValueChange(row.id, e.target.value)} required disabled={!row.wavelength} className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition duration-150 ease-in-out ${!row.wavelength ? 'bg-gray-100 cursor-not-allowed' : ''}`} placeholder="Absorbance" step="any" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-left">*Select a unique wavelength and enter its absorbance value for each row.</p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm text-left transition-all duration-300 ease-in-out opacity-100">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full sm:w-auto flex-grow px-6 py-3 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-base transform hover:scale-105 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isLoading ? 'Analyzing...' : 'Analyze Soil Data'}
              </button>
              <button
                type="button" // Important: type="button" to prevent form submission
                onClick={handleViewMetrics}
                disabled={isLoading || !metricsData} // Disable only if loading analysis or metrics failed/not loaded
                className={`w-full sm:w-auto px-6 py-3 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-base transform hover:scale-105 ${ (isLoading || !metricsData) ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                title={isLoading ? "Analysis in progress..." : !metricsData ? "Metrics data unavailable" : "View model performance metrics"}
               >
                 View Performance Metrics
               </button>
          </div>
        </form>
      </div>

      {/* --- Output Section (Only on Form View after successful submission) --- */}
      {submitted && data && (
        <div ref={outputRef} className="mt-8 w-full max-w-4xl space-y-8 md:max-w-6xl animate-fade-in"> {/* Added fade-in animation */}
          {/* Soil Attributes Table */}
           <div className="bg-white p-6 rounded-xl shadow-lg transform transition duration-300 hover:scale-[1.01] hover:shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Soil Analysis Results</h2>
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Attribute</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(data)
                            .filter(([key]) => !['recommendedCrops'].includes(key) && data[key] !== undefined && data[key] !== null)
                            .map(([key, value]) => {
                            const attributeMap = {
                                capacityMoist: { name: 'Capacity Moist', unit: '' },
                                temperature: { name: 'Temperature', unit: '°C' },
                                moisture: { name: 'Moisture', unit: '%' },
                                electricalConductivity: { name: 'Electrical Conductivity', unit: 'dS/m' },
                                pH: { name: 'pH', unit: '' },
                                nitro: { name: 'Nitrogen (N)', unit: 'mg/kg' },
                                phosphorus: { name: 'Phosphorus (P)', unit: 'mg/kg' },
                                potassium: { name: 'Potassium (K)', unit: 'mg/kg' },
                            };
                            const { name = key, unit = '' } = attributeMap[key] || {};
                            return (
                                <tr key={key} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{value}{unit && ` ${unit}`}</td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>


          {/* Key Indicators Dashboard */}
           <div className="bg-white p-6 rounded-xl shadow-lg transform transition duration-300 hover:scale-[1.01] hover:shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Key Indicators Dashboard</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    {/* Card styling with hover effect */}
                    {data.pH !== undefined && ( <div className={`p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 ${data.pH < 6 ? 'bg-orange-50 border-orange-200' : data.pH > 7.5 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}> <h3 className="text-sm md:text-base font-semibold text-gray-700">pH</h3> <p className="text-lg md:text-xl font-bold text-gray-900">{data.pH}</p> <p className="text-xs text-gray-600">{data.pH < 6 ? 'Acidic' : data.pH > 7.5 ? 'Alkaline' : 'Neutral'}</p> </div> )}
                    {data.nitro !== undefined && ( <div className="p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 bg-yellow-50 border-yellow-200"> <h3 className="text-sm md:text-base font-semibold text-gray-700">Nitrogen (N)</h3> <p className="text-lg md:text-xl font-bold text-gray-900">{data.nitro}</p> <p className="text-xs text-gray-600">mg/kg</p> </div> )}
                    {data.potassium !== undefined && ( <div className="p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 bg-red-50 border-red-200"> <h3 className="text-sm md:text-base font-semibold text-gray-700">Potassium (K)</h3> <p className="text-lg md:text-xl font-bold text-gray-900">{data.potassium}</p> <p className="text-xs text-gray-600">mg/kg</p> </div> )}
                    {data.phosphorus !== undefined && ( <div className="p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 bg-purple-50 border-purple-200"> <h3 className="text-sm md:text-base font-semibold text-gray-700">Phosphorus (P)</h3> <p className="text-lg md:text-xl font-bold text-gray-900">{data.phosphorus}</p> <p className="text-xs text-gray-600">mg/kg</p> </div> )}
                    {data.moisture !== undefined && ( <div className="p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 bg-cyan-50 border-cyan-200"> <h3 className="text-sm md:text-base font-semibold text-gray-700">Moisture</h3> <p className="text-lg md:text-xl font-bold text-gray-900">{data.moisture}%</p> </div> )}
                    {data.electricalConductivity !== undefined && ( <div className="p-4 rounded-lg shadow border transform transition duration-300 hover:scale-105 bg-lime-50 border-lime-200"> <h3 className="text-sm md:text-base font-semibold text-gray-700">EC</h3> <p className="text-lg md:text-xl font-bold text-gray-900">{data.electricalConductivity}</p> <p className="text-xs text-gray-600">dS/m</p> </div> )}
                </div>
                 {/* Recommended Crops Section */}
                {(data.recommendedCrops && data.recommendedCrops.length > 0) && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                    <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Recommended Crops</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.recommendedCrops.map((crop, index) => (
                        <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-100 transform transition duration-300 hover:scale-105 hover:shadow-md">
                            <img src={crop.image || 'https://via.placeholder.com/64/cccccc/969696?text=Crop'} alt={crop.name} className="w-16 h-16 object-cover rounded-full mr-4 flex-shrink-0 bg-gray-200" onError={(e) => { e.target.src = 'https://via.placeholder.com/64/cccccc/969696?text=Crop'; }}/>
                            <div>
                            <h3 className="text-lg font-semibold text-gray-800">{crop.name}</h3>
                            <p className="text-sm text-gray-600">Suitability: <span className="font-medium text-gray-700">{crop.match}%</span></p>
                            </div>
                        </div>
                        ))}
                    </div>
                    </div>
                )}
            </div> {/* End Dashboard Card */}

        </div>
      )}
    </>
  );

  // Main component return based on view
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4 pt-10 pb-20">
       {/* Add global styles or Tailwind JIT directives if needed */}
       <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        ${hideNumberInputArrows}
      `}</style>
      {currentView === 'form' ? renderFormView() : renderMetricsView()}
    </div>
  );
}

export default HomePage;