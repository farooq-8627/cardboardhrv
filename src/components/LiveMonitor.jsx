import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import connectionService from "../utils/connectionService";
import { useAppContext } from "../context/AppContext";
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
	const directConnect = searchParams.get("directConnect") === "true";

	const {
		isConnected,
		heartRateData,
		currentHeartRate,
		hrvMetrics,
		sessionId,
		connectionStatus,
		deviceInfo,
		cameraFrame,
		lastFrameTime,
		isRecording,
		initializeConnection,
		handleCameraFrame,
		cleanup,
	} = useAppContext();

	// Initialize connection service when component mounts
	useEffect(() => {
		const urlSessionId =
			searchParams.get("sessionId") ||
			localStorage.getItem("cardboardhrv-session-id");

		if (!urlSessionId) {
			return;
		}

		const setupConnection = async () => {
			const success = await initializeConnection(urlSessionId, "desktop");
			if (success) {
				// Set up listener for camera frames
				if (connectionService.useDirectConnection) {
					window.addEventListener("message", handleDirectMessage);
				} else {
					const database = connectionService.getDatabase();
					if (database) {
						const frameRef = ref(
							database,
							`sessions/${urlSessionId}/cameraFrame`
						);
						onValue(frameRef, (snapshot) => {
							const frameData = snapshot.val();
							if (frameData && frameData.imageData) {
								handleCameraFrame(frameData);
							}
						});
					}
				}

				if (directConnect) {
					connectionService.sendMessage("Desktop is ready for connection");
				}
			}
		};

		setupConnection();

		return () => {
			cleanup();
			window.removeEventListener("message", handleDirectMessage);
		};
	}, [
		searchParams,
		directConnect,
		initializeConnection,
		handleCameraFrame,
		cleanup,
	]);

	// Handle direct messages (for camera frames)
	const handleDirectMessage = (event) => {
		if (event.origin !== window.location.origin) return;

		const data = event.data;
		if (!data || !data.type || !data.sessionId || data.sessionId !== sessionId)
			return;

		if (data.type === "cameraFrame") {
			handleCameraFrame(data);
		}
	};

	// Chart data
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
		labels: heartRateData.map((_, index) => index.toString()),
		datasets: [
			{
				label: "HRV (ms)",
				data: heartRateData.map(() => hrvMetrics.rmssd),
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
			duration: 0,
		},
	};

	return (
		<div className="live-monitor">
			<div className="section-title">
				<h1>Live Heart Rate Monitor</h1>
			</div>

			<div className="monitor-container">
				{!sessionId ? (
					<div className="error-message card">
						<h2>Error</h2>
						<p>
							No session ID provided. Please go back and connect your phone.
						</p>
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
										<Line data={heartRateChartData} options={chartOptions} />
									</div>
								) : (
									<div className="no-data-message">
										<p>Waiting for heart rate data...</p>
									</div>
								)}
							</div>

							<div className="metric-card hrv card">
								<h2>Heart Rate Variability</h2>
								<div className="metric-value">
									<span className="value">{hrvMetrics.rmssd || "--"}</span>
									<span className="unit">ms</span>
								</div>
								{heartRateData.length > 0 ? (
									<div className="chart-container">
										<Line data={hrvChartData} options={chartOptions} />
									</div>
								) : (
									<div className="no-data-message">
										<p>Waiting for HRV data...</p>
									</div>
								)}
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export default LiveMonitor;
