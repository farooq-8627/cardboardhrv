import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import connectionService from "../utils/connectionService";
import { Line } from "react-chartjs-2";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend
);

function LiveMonitor() {
	const [searchParams] = useSearchParams();
	const sessionId =
		searchParams.get("sessionId") ||
		localStorage.getItem("cardboardhrv-session-id");
	const directConnect = searchParams.get("directConnect") === "true";

	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [heartRateData, setHeartRateData] = useState([]);
	const [hrvData, setHrvData] = useState([]);
	const [currentHeartRate, setCurrentHeartRate] = useState(0);
	const [currentHRV, setCurrentHRV] = useState(0);
	const [connectionInfo, setConnectionInfo] = useState("");
	const [deviceInfo, setDeviceInfo] = useState(null);
	const [error, setError] = useState("");

	// Chart data
	const heartRateChartRef = useRef(null);
	const hrvChartRef = useRef(null);
	const maxDataPoints = 60; // Show 60 data points on the chart

	// Initialize connection service when component mounts
	useEffect(() => {
		if (!sessionId) {
			setError(
				"No session ID provided. Please go back and connect your phone."
			);
			return;
		}

		setConnectionInfo(`Initializing connection for session ${sessionId}...`);

		const initializeConnection = async () => {
			// Initialize connection service
			const success = await connectionService.initialize(sessionId, "desktop");
			if (success) {
				console.log(`Initialized connection service for session ${sessionId}`);

				// Set up event listeners
				connectionService.on(
					"connectionStatusChanged",
					handleConnectionStatusChanged
				);
				connectionService.on("devicesPaired", handleDevicesPaired);
				connectionService.on("heartRateData", handleHeartRateData);

				// If direct connect is true, try to connect immediately
				if (directConnect) {
					connectionService.sendMessage("Desktop is ready for connection");
				}
			} else {
				console.error("Failed to initialize connection service");
				setError("Failed to initialize connection. Please try again.");
			}
		};

		initializeConnection();

		// Clean up event listeners
		return () => {
			connectionService.off(
				"connectionStatusChanged",
				handleConnectionStatusChanged
			);
			connectionService.off("devicesPaired", handleDevicesPaired);
			connectionService.off("heartRateData", handleHeartRateData);

			// Disconnect from the session
			connectionService.disconnect();
		};
	}, [sessionId, directConnect]);

	// Handle connection status changes
	const handleConnectionStatusChanged = (data) => {
		console.log("Connection status changed:", data.status);
		setConnectionStatus(data.status);
		setConnectionInfo(`Connection status: ${data.status}`);
	};

	// Handle devices paired event
	const handleDevicesPaired = (data) => {
		console.log("Devices paired:", data);
		setDeviceInfo(data);
		setConnectionInfo(`Connected to mobile device: ${data.mobileDeviceId}`);
	};

	// Handle heart rate data
	const handleHeartRateData = (data) => {
		console.log("Heart rate data received:", data);

		// Update current heart rate
		setCurrentHeartRate(data.heartRate);

		// Add to heart rate data array
		setHeartRateData((prevData) => {
			const newData = [
				...prevData,
				{
					timestamp: data.timestamp,
					value: data.heartRate,
				},
			];

			// Keep only the last maxDataPoints
			return newData.slice(-maxDataPoints);
		});

		// Calculate HRV (simple RMSSD calculation)
		if (heartRateData.length > 1) {
			// Convert heart rate to RR intervals (in ms)
			const lastHR = heartRateData[heartRateData.length - 1].value;
			const currentHR = data.heartRate;

			const lastRR = 60000 / lastHR;
			const currentRR = 60000 / currentHR;

			// Calculate difference
			const diff = Math.abs(currentRR - lastRR);

			// Simple RMSSD-like calculation (just for demonstration)
			const hrv = Math.sqrt(diff * diff);
			setCurrentHRV(Math.round(hrv));

			// Add to HRV data array
			setHrvData((prevData) => {
				const newData = [
					...prevData,
					{
						timestamp: data.timestamp,
						value: Math.round(hrv),
					},
				];

				// Keep only the last maxDataPoints
				return newData.slice(-maxDataPoints);
			});
		}
	};

	// Prepare chart data
	const heartRateChartData = {
		labels: heartRateData.map((_, index) => index.toString()),
		datasets: [
			{
				label: "Heart Rate (BPM)",
				data: heartRateData.map((data) => data.value),
				borderColor: "rgb(255, 99, 132)",
				backgroundColor: "rgba(255, 99, 132, 0.5)",
				tension: 0.3,
			},
		],
	};

	const hrvChartData = {
		labels: hrvData.map((_, index) => index.toString()),
		datasets: [
			{
				label: "HRV (ms)",
				data: hrvData.map((data) => data.value),
				borderColor: "rgb(53, 162, 235)",
				backgroundColor: "rgba(53, 162, 235, 0.5)",
				tension: 0.3,
			},
		],
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		scales: {
			y: {
				beginAtZero: false,
			},
		},
		animation: {
			duration: 0, // Disable animation for better performance
		},
	};

	return (
		<div className="live-monitor">
			<div className="section-title">
				<h1>Live Heart Rate Monitor</h1>
			</div>

			<div className="monitor-container">
				{error ? (
					<div className="error-message card">
						<h2>Error</h2>
						<p>{error}</p>
						<button
							className="primary-button"
							onClick={() => (window.location.href = "/connect")}
						>
							Go to Connect Page
						</button>
					</div>
				) : (
					<>
						<div className="connection-status card">
							<h2>Connection Status</h2>
							<div className={`status-indicator ${connectionStatus}`}>
								<div className="status-dot"></div>
								<span className="status-text">
									{connectionStatus === "connected"
										? "Connected"
										: connectionStatus === "connecting"
										? "Connecting..."
										: connectionStatus === "disconnected"
										? "Disconnected"
										: "Unknown"}
								</span>
							</div>
							<p className="connection-info">{connectionInfo}</p>
							{deviceInfo && (
								<div className="device-info">
									<p>
										<strong>Session ID:</strong> {sessionId}
									</p>
									<p>
										<strong>Mobile Device:</strong> {deviceInfo.mobileDeviceId}
									</p>
									<p>
										<strong>Connected at:</strong>{" "}
										{new Date(deviceInfo.timestamp).toLocaleTimeString()}
									</p>
								</div>
							)}
						</div>

						<div className="metrics-container">
							<div className="metric-card heart-rate card">
								<h2>Heart Rate</h2>
								<div className="metric-value">
									<span className="value">{currentHeartRate}</span>
									<span className="unit">BPM</span>
								</div>
								<div className="chart-container">
									<Line
										ref={heartRateChartRef}
										data={heartRateChartData}
										options={chartOptions}
									/>
								</div>
							</div>

							<div className="metric-card hrv card">
								<h2>Heart Rate Variability</h2>
								<div className="metric-value">
									<span className="value">{currentHRV}</span>
									<span className="unit">ms</span>
								</div>
								<div className="chart-container">
									<Line
										ref={hrvChartRef}
										data={hrvChartData}
										options={chartOptions}
									/>
								</div>
							</div>
						</div>

						<div className="instructions card">
							<h2>How to Use</h2>
							<ol>
								<li>
									Make sure your phone is connected and the camera is active
								</li>
								<li>Position your finger over the phone's camera lens</li>
								<li>Keep your finger still and maintain consistent pressure</li>
								<li>
									Watch your heart rate and HRV measurements update in real-time
								</li>
							</ol>
							<p className="tip">
								<strong>Tip:</strong> For best results, ensure good lighting and
								avoid moving your finger during measurement.
							</p>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export default LiveMonitor;
