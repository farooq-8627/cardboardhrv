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
	const [cameraFrame, setCameraFrame] = useState(null);
	const [lastFrameTime, setLastFrameTime] = useState(null);
	const [isRecording, setIsRecording] = useState(false);

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

				// Set up listener for camera frames
				if (connectionService.useDirectConnection) {
					window.addEventListener("message", handleDirectMessage);
				} else {
					// Set up Firebase listener for camera frames
					const database = connectionService.getDatabase();
					if (database) {
						const frameRef = ref(database, `sessions/${sessionId}/cameraFrame`);
						onValue(frameRef, (snapshot) => {
							const frameData = snapshot.val();
							if (frameData && frameData.imageData) {
								handleCameraFrame(frameData);
							}
						});
					}
				}

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

			// Clean up direct message listener
			window.removeEventListener("message", handleDirectMessage);

			// Disconnect from the session
			connectionService.disconnect();
		};
	}, [sessionId, directConnect]);

	// Handle direct messages (for camera frames)
	const handleDirectMessage = (event) => {
		// Only process messages from our own origin
		if (event.origin !== window.location.origin) return;

		const data = event.data;
		if (!data || !data.type || !data.sessionId) return;

		// Only process messages for our session
		if (data.sessionId !== sessionId) return;

		if (data.type === "cameraFrame") {
			handleCameraFrame(data);
		}
	};

	// Handle camera frame data
	const handleCameraFrame = (data) => {
		if (data.imageData) {
			setCameraFrame(data.imageData);
			setLastFrameTime(data.timestamp);
			setIsRecording(true);

			// Set a timeout to mark as not recording if no frames received for 5 seconds
			clearTimeout(window.recordingTimeout);
			window.recordingTimeout = setTimeout(() => {
				setIsRecording(false);
			}, 5000);
		}
	};

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
							{connectionStatus === "connecting" && (
								<div
									className="connection-instructions"
									style={{
										marginTop: "1rem",
										padding: "1rem",
										backgroundColor: "#f8f9fa",
										borderRadius: "8px",
									}}
								>
									<h3 style={{ marginBottom: "0.5rem" }}>
										Waiting for Mobile Device
									</h3>
									<p>
										Please scan the QR code on the Connect Phone page with your
										mobile device.
									</p>
									<p>Make sure your mobile device has camera access enabled.</p>
									<button
										className="primary-button"
										onClick={() => (window.location.href = "/connect")}
										style={{ marginTop: "1rem" }}
									>
										Go to Connect Page
									</button>
								</div>
							)}
						</div>

						{/* Camera Feed Display */}
						<div className="camera-feed-card card">
							<h2>Mobile Camera Feed</h2>
							<div
								className="camera-status"
								style={{
									display: "flex",
									alignItems: "center",
									marginBottom: "0.5rem",
								}}
							>
								<div
									className={`status-dot ${
										isRecording ? "recording" : "not-recording"
									}`}
									style={{
										width: "12px",
										height: "12px",
										borderRadius: "50%",
										backgroundColor: isRecording ? "#dc3545" : "#6c757d",
										marginRight: "8px",
										animation: isRecording ? "pulse 1s infinite" : "none",
									}}
								></div>
								<span>{isRecording ? "Recording" : "Not Recording"}</span>
								{lastFrameTime && (
									<span
										style={{
											marginLeft: "auto",
											fontSize: "0.8rem",
											color: "#6c757d",
										}}
									>
										Last frame: {new Date(lastFrameTime).toLocaleTimeString()}
									</span>
								)}
							</div>

							<div
								className="camera-feed-container"
								style={{
									position: "relative",
									width: "100%",
									height: "240px",
									backgroundColor: "#f8f9fa",
									borderRadius: "4px",
									overflow: "hidden",
								}}
							>
								{cameraFrame ? (
									<img
										src={cameraFrame}
										alt="Camera Feed"
										style={{
											width: "100%",
											height: "100%",
											objectFit: "contain",
											display: "block",
										}}
									/>
								) : (
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											justifyContent: "center",
											height: "100%",
										}}
									>
										<div
											className="camera-icon"
											style={{ fontSize: "3rem", marginBottom: "1rem" }}
										>
											📷
										</div>
										<p>Waiting for camera feed from mobile device...</p>
									</div>
								)}

								{isRecording && (
									<div
										className="recording-indicator"
										style={{
											position: "absolute",
											top: "10px",
											right: "10px",
											backgroundColor: "rgba(220, 53, 69, 0.7)",
											color: "white",
											padding: "0.25rem 0.5rem",
											borderRadius: "4px",
											fontSize: "0.8rem",
											display: "flex",
											alignItems: "center",
										}}
									>
										<div
											style={{
												width: "8px",
												height: "8px",
												borderRadius: "50%",
												backgroundColor: "#fff",
												marginRight: "4px",
												animation: "pulse 1s infinite",
											}}
										></div>
										REC
									</div>
								)}
							</div>

							<div
								className="camera-instructions"
								style={{
									marginTop: "0.5rem",
									fontSize: "0.9rem",
									color: "#6c757d",
								}}
							>
								<p>
									This shows what your phone's camera is currently seeing.
									Position your finger over the camera lens for accurate
									readings.
								</p>
							</div>
						</div>

						<div className="metrics-container">
							<div className="metric-card heart-rate card">
								<h2>Heart Rate</h2>
								<div className="metric-value">
									<span className="value">{currentHeartRate || "--"}</span>
									<span className="unit">BPM</span>
								</div>
								{heartRateData.length > 0 ? (
									<div className="chart-container">
										<Line
											ref={heartRateChartRef}
											data={heartRateChartData}
											options={chartOptions}
										/>
									</div>
								) : (
									<div
										className="no-data-message"
										style={{
											padding: "2rem",
											textAlign: "center",
											color: "#6c757d",
										}}
									>
										<p>Waiting for heart rate data...</p>
										<div
											className="spinner"
											style={{
												margin: "1rem auto",
												width: "30px",
												height: "30px",
												borderRadius: "50%",
												border: "3px solid #f3f3f3",
												borderTop: "3px solid #3498db",
												animation: "spin 1s linear infinite",
											}}
										></div>
									</div>
								)}
							</div>

							<div className="metric-card hrv card">
								<h2>Heart Rate Variability</h2>
								<div className="metric-value">
									<span className="value">{currentHRV || "--"}</span>
									<span className="unit">ms</span>
								</div>
								{hrvData.length > 0 ? (
									<div className="chart-container">
										<Line
											ref={hrvChartRef}
											data={hrvChartData}
											options={chartOptions}
										/>
									</div>
								) : (
									<div
										className="no-data-message"
										style={{
											padding: "2rem",
											textAlign: "center",
											color: "#6c757d",
										}}
									>
										<p>Waiting for HRV data...</p>
										<div
											className="spinner"
											style={{
												margin: "1rem auto",
												width: "30px",
												height: "30px",
												borderRadius: "50%",
												border: "3px solid #f3f3f3",
												borderTop: "3px solid #3498db",
												animation: "spin 1s linear infinite",
											}}
										></div>
									</div>
								)}
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
							<div
								className="tip"
								style={{
									marginTop: "1rem",
									padding: "0.75rem",
									backgroundColor: "#e9f7ef",
									borderRadius: "4px",
									borderLeft: "4px solid #28a745",
								}}
							>
								<p>
									<strong>Tip:</strong> For best results, ensure good lighting
									and avoid moving your finger during measurement.
								</p>
							</div>
							<div
								className="troubleshooting"
								style={{
									marginTop: "1rem",
									padding: "0.75rem",
									backgroundColor: "#f8f9fa",
									borderRadius: "4px",
									borderLeft: "4px solid #007bff",
								}}
							>
								<p>
									<strong>Troubleshooting:</strong>
								</p>
								<ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
									<li>
										If no data appears, check that your phone's camera is
										uncovered
									</li>
									<li>
										Try adjusting the pressure of your finger on the camera
									</li>
									<li>Ensure there is adequate lighting in the room</li>
									<li>If problems persist, try reconnecting your phone</li>
								</ul>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export default LiveMonitor;
