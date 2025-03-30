// frontend/src/pages/Home.jsx
import React, { useState } from 'react';

function Home() {
  // State to hold the selected file object
  const [selectedFile, setSelectedFile] = useState(null);
  // State to store a message for the user (e.g., filename or error)
  const [message, setMessage] = useState('Please select a PDF file.');

  // Handler for when a file is selected in the input
  const handleFileChange = (event) => {
    const file = event.target.files[0]; // Get the first file selected

    if (file) {
      // Basic validation: Check if the file type is PDF
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setMessage(`File selected: ${file.name}`);
      } else {
        // Reset if it's not a PDF
        setSelectedFile(null);
        setMessage('Invalid file type. Please select a PDF.');
        // Optionally clear the input value if needed (can be tricky across browsers)
        event.target.value = null;
      }
    } else {
      // No file selected (e.g., user cancelled)
      setSelectedFile(null);
      setMessage('Please select a PDF file.');
    }
  };

  // Handler for the form submission (placeholder for now)
  const handleSubmit = (event) => {
    event.preventDefault(); // Prevent default form submission behavior

    if (!selectedFile) {
      setMessage('No file selected to analyze.');
      return;
    }

    // --- !!! Placeholder for Backend Interaction !!! ---
    // Here you would typically:
    // 1. Create a FormData object
    //    const formData = new FormData();
    //    formData.append('spectrometerPdf', selectedFile); // Key matches backend expectation
    //
    // 2. Use fetch or axios to send `formData` to your Python backend API endpoint
    //    fetch('http://localhost:5000/api/analyze', { // Adjust URL/port as needed
    //      method: 'POST',
    //      body: formData,
    //    })
    //    .then(response => response.json())
    //    .then(data => {
    //      console.log('Analysis Result:', data);
    //      setMessage(`Analysis complete for ${selectedFile.name}.`);
    //      // Handle success - maybe navigate to a results page or display results
    //    })
    //    .catch(error => {
    //      console.error('Error uploading file:', error);
    //      setMessage('Error uploading or analyzing the file.');
    //      // Handle error - show user feedback
    //    });
    //
    // For now, just log a message
    console.log('Submitting file:', selectedFile.name);
    setMessage(`Processing ${selectedFile.name}... (Backend not yet connected)`);
    // You might want to disable the button here while processing
  };

  return (
    // Main container - centers content vertically and horizontally using Flexbox
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-100 via-blue-100 to-purple-100 p-4">
      {/* Content Card */}
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">

        {/* Title */}
        <h1 className="text-3xl font-bold mb-4 text-gray-800">
          Soil Spectrometer Analyzer
        </h1>

        {/* Instructions */}
        <p className="text-gray-600 mb-6">
          Upload your spectrometer data PDF for analysis.
        </p>

        {/* Form Element - good practice even without page reload */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* File Input Area */}
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
              Select PDF File
            </label>
            {/* Using a common Tailwind pattern for styling file inputs */}
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".pdf,application/pdf" // Hint for browser file picker
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 border border-gray-300 rounded-lg cursor-pointer
                         file:mr-4 file:py-2 file:px-4
                         file:rounded-md file:border-0
                         file:text-sm file:font-semibold
                         file:bg-blue-50 file:text-blue-700
                         hover:file:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            />
          </div>

          {/* Message Display Area */}
          {/* Give it a fixed height to prevent layout shifts when message appears/disappears */}
          <div className="mt-4 text-sm text-gray-700 h-6">
             {message}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedFile} // Disable button if no valid file is selected
            className={`w-full px-4 py-2 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                        ${selectedFile
                          ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                          : 'bg-gray-400 cursor-not-allowed'
                        }`}
          >
            Analyze PDF
          </button>

        </form>
      </div>
    </div>
  );
}

export default Home;