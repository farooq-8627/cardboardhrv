import React, { useEffect, useMemo } from "react";
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
import "../styles/LiveMonitor.css";

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
				console.log("Setting up camera frame listeners...");
				// Set up listener for camera frames
				if (connectionService.useDirectConnection) {
					console.log("Using direct connection for camera frames");
					window.addEventListener("message", handleDirectMessage);
				} else {
					console.log("Using Firebase for camera frames");
					const database = connectionService.getDatabase();
					if (database) {
						const frameRef = ref(
							database,
							`sessions/${urlSessionId}/cameraFrame`
						);
						onValue(frameRef, (snapshot) => {
							const frameData = snapshot.val();
							if (frameData && frameData.imageData) {
								console.log(
									"Processing frame from Firebase at:",
									new Date(frameData.timestamp).toLocaleTimeString()
								);
								handleCameraFrame(frameData);
							} else if (!frameData) {
								console.log("No frame data available");
							}
						});
					} else {
						console.error("Firebase database not available");
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
			console.log(
				"Processing frame from direct message at:",
				new Date().toLocaleTimeString()
			);
			handleCameraFrame(data);
		}
	};

	// Prepare chart data
	const chartData = useMemo(() => {
		// Get the last 30 data points or all if less than 30
		const dataPoints = heartRateData.slice(-30);

		return {
			labels: dataPoints.map((_, index) => ""),
			datasets: [
				{
					label: "Heart Rate (BPM)",
					data: dataPoints.map((point) => point.value),
					borderColor: "#ff6b6b",
					backgroundColor: "rgba(255, 107, 107, 0.1)",
					borderWidth: 2,
					fill: true,
					tension: 0.4,
					pointRadius: 0,
				},
			],
		};
	}, [heartRateData]);

	// Chart options
	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "top",
				align: "end",
				labels: {
					boxWidth: 15,
					usePointStyle: true,
					pointStyle: "rect",
				},
				title: {
					text: "Heart Rate Variability",
					display: true,
					font: {
						size: 14,
					},
				},
			},
			tooltip: {
				mode: "index",
				intersect: false,
			},
		},
		scales: {
			y: {
				min: 40,
				max: 120,
				ticks: {
					stepSize: 10,
					callback: function (value) {
						return value;
					},
				},
				grid: {
					color: "rgba(0, 0, 0, 0.05)",
				},
				title: {
					display: true,
					text: "BPM",
					font: {
						size: 12,
					},
				},
			},
			x: {
				grid: {
					display: false,
				},
				title: {
					display: true,
					text: "Time",
					font: {
						size: 12,
					},
				},
			},
		},
		animation: {
			duration: 500,
		},
		elements: {
			line: {
				tension: 0.4,
			},
		},
	};

	return (
		<div className="live-monitor">
			<h1 className="page-title">Live Heart Rate Monitor</h1>

			{/* Connection Success Message */}
			{connectionStatus === "connected" && (
				<div className="connection-success">
					<div className="success-icon">✓</div>
					<p>Your phone is connected and sending heart rate data.</p>
				</div>
			)}

			{/* Connection Status Section */}
			<div className="connection-status-section">
				<h2>Connection Status</h2>
				<div className="connection-details">
					<div className="status-indicator">
						<div className={`status-dot ${connectionStatus}`}></div>
						<span>
							{connectionStatus === "connected"
								? "Connected"
								: connectionStatus === "connecting"
								? "Connecting..."
								: "Disconnected"}
						</span>
					</div>
					{deviceInfo && (
						<div className="connection-info">
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
			</div>

			{/* Mobile Camera Feed Section */}
			<div className="camera-feed-section">
				<h2>Mobile Camera Feed</h2>
				<div className="camera-status">
					<div className="status-indicator">
						<div
							className={`status-dot ${
								isRecording ? "connected" : "disconnected"
							}`}
						></div>
						<span>{isRecording ? "Recording" : "Not Recording"}</span>
					</div>
					{lastFrameTime && (
						<div className="frame-info">
							<p>Last frame: {new Date(lastFrameTime).toLocaleTimeString()}</p>
						</div>
					)}
				</div>
				<div className="camera-preview">
					{cameraFrame ? (
						<img
							src={`data:image/jpeg;base64,${cameraFrame}`}
							alt="Camera feed"
						/>
					) : (
						<div className="camera-placeholder">
							<span className="camera-icon">📷</span>
							<p>Connect your mobile device to start streaming</p>
						</div>
					)}
				</div>
			</div>

			<div className="monitor-grid">
				{/* Heart Rate Card */}
				<div className="metric-card">
					<h2>Heart Rate</h2>
					<div className="heart-rate">
						<div className="metric-value">
							<span className="value">{currentHeartRate || 0}</span>
							<span className="unit">BPM</span>
						</div>
					</div>
				</div>

				{/* HRV Metrics Card */}
				<div className="metric-card">
					<h2>HRV Metrics</h2>
					<div className="metrics-grid">
						<div className="metric">
							<span className="metric-label">SDNN</span>
							<div className="metric-value">
								<span className="value">{hrvMetrics.sdnn || 0}</span>
								<span className="unit">ms</span>
							</div>
						</div>
						<div className="metric">
							<span className="metric-label">RMSSD</span>
							<div className="metric-value">
								<span className="value">{hrvMetrics.rmssd || 0}</span>
								<span className="unit">ms</span>
							</div>
						</div>
						<div className="metric">
							<span className="metric-label">LF</span>
							<div className="metric-value">
								<span className="value">{hrvMetrics.lf || 0}</span>
								<span className="unit">ms²</span>
							</div>
						</div>
						<div className="metric">
							<span className="metric-label">HF</span>
							<div className="metric-value">
								<span className="value">{hrvMetrics.hf || 0}</span>
								<span className="unit">ms²</span>
							</div>
						</div>
						<div className="metric">
							<span className="metric-label">LF/HF</span>
							<div className="metric-value">
								<span className="value">{hrvMetrics.lfhf || 0}</span>
							</div>
						</div>
					</div>
				</div>

				{/* Heart Rate Trend Card */}
				<div className="metric-card heart-rate-trend">
					<h2>Heart Rate Trend</h2>
					<div className="chart-container">
						{heartRateData.length > 0 ? (
							<Line data={chartData} options={chartOptions} />
						) : (
							<div className="no-data">
								<p>Waiting for heart rate data...</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default LiveMonitor;
