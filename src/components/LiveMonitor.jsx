import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
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

function LiveMonitor({
	isConnected,
	heartRateData,
	currentHeartRate,
	hrvMetrics,
	sendMessageToMobile,
}) {
	const [isMonitoring, setIsMonitoring] = useState(false);
	const [sessionStartTime, setSessionStartTime] = useState(null);
	const [sessionDuration, setSessionDuration] = useState(0);
	const timerRef = useRef(null);
	const chartRef = useRef(null);

	// Start/stop monitoring session
	const toggleMonitoring = () => {
		if (isMonitoring) {
			// Stop monitoring
			setIsMonitoring(false);
			clearInterval(timerRef.current);

			// Send message to mobile device
			if (sendMessageToMobile) {
				sendMessageToMobile("Monitoring session stopped");
			}
		} else {
			// Start monitoring
			setIsMonitoring(true);
			setSessionStartTime(new Date());
			timerRef.current = setInterval(() => {
				setSessionDuration((prev) => prev + 1);
			}, 1000);

			// Send message to mobile device
			if (sendMessageToMobile) {
				sendMessageToMobile("Monitoring session started");
			}
		}
	};

	// Clean up timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, []);

	// Send connection status to mobile device when connected
	useEffect(() => {
		if (isConnected && sendMessageToMobile) {
			sendMessageToMobile("Connected to Live Monitor");
		}
	}, [isConnected, sendMessageToMobile]);

	// Format session duration as MM:SS
	const formatDuration = (seconds) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs
			.toString()
			.padStart(2, "0")}`;
	};

	// Export session data
	const exportSession = () => {
		if (!heartRateData.length) return;

		// Create CSV content
		const csvContent = [
			"timestamp,heartRate",
			...heartRateData.map(
				(data) => `${data.timestamp.toISOString()},${data.heartRate}`
			),
		].join("\n");

		// Create and download file
		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.setAttribute("href", url);
		a.setAttribute(
			"download",
			`hrv-session-${new Date()
				.toISOString()
				.slice(0, 19)
				.replace(/:/g, "-")}.csv`
		);
		a.click();

		// Send message to mobile device
		if (sendMessageToMobile) {
			sendMessageToMobile("Data exported from Live Monitor");
		}
	};

	// Prepare chart data
	const chartData = {
		labels: heartRateData.map((data) => {
			const time = new Date(data.timestamp);
			return `${time.getHours().toString().padStart(2, "0")}:${time
				.getMinutes()
				.toString()
				.padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`;
		}),
		datasets: [
			{
				label: "Heart Rate (BPM)",
				data: heartRateData.map((data) => data.heartRate),
				borderColor: "rgb(255, 99, 132)",
				backgroundColor: "rgba(255, 99, 132, 0.5)",
				tension: 0.3,
			},
		],
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		scales: {
			y: {
				min: 40,
				max: 120,
				title: {
					display: true,
					text: "BPM",
				},
			},
			x: {
				title: {
					display: true,
					text: "Time",
				},
				ticks: {
					maxTicksLimit: 10,
				},
			},
		},
		plugins: {
			legend: {
				position: "top",
			},
			title: {
				display: true,
				text: "Heart Rate Variability",
			},
		},
	};

	return (
		<div className="live-monitor">
			<div className="section-title">
				<h2>Live Heart Rate Monitor</h2>
			</div>

			{!isConnected ? (
				<div className="not-connected card">
					<h3>No Device Connected</h3>
					<p>
						Please connect your phone to start monitoring your heart rate
						variability.
					</p>
					<Link to="/connect" className="cta-button">
						Connect Phone
					</Link>
				</div>
			) : (
				<div className="monitoring-container">
					<div className="connection-status connected card">
						<div className="success-icon">✓</div>
						<p>Your phone is connected and sending heart rate data.</p>
					</div>

					<div className="vital-cards">
						<div className="vital-card card">
							<h3>Heart Rate</h3>
							<div className="heart-rate-value">
								<span className="value">{currentHeartRate}</span>
								<span className="unit">BPM</span>
							</div>
							<div className="heart-animation">
								<div
									className="heart"
									style={{
										animation: `heartbeat ${
											60 / (currentHeartRate || 60)
										}s infinite`,
									}}
								></div>
							</div>
						</div>

						<div className="vital-card card">
							<h3>HRV Metrics</h3>
							<div className="metrics-grid">
								<div className="metric">
									<div className="metric-name">SDNN</div>
									<div className="metric-value">{hrvMetrics.sdnn} ms</div>
								</div>
								<div className="metric">
									<div className="metric-name">RMSSD</div>
									<div className="metric-value">{hrvMetrics.rmssd} ms</div>
								</div>
								<div className="metric">
									<div className="metric-name">LF</div>
									<div className="metric-value">{hrvMetrics.lf} ms²</div>
								</div>
								<div className="metric">
									<div className="metric-name">HF</div>
									<div className="metric-value">{hrvMetrics.hf} ms²</div>
								</div>
								<div className="metric">
									<div className="metric-name">LF/HF</div>
									<div className="metric-value">{hrvMetrics.lfhf}</div>
								</div>
							</div>
						</div>
					</div>

					<div className="chart-container card">
						<div className="session-controls">
							<button
								className={`control-button ${isMonitoring ? "stop" : "start"}`}
								onClick={toggleMonitoring}
							>
								{isMonitoring ? "Stop Session" : "Start Session"}
							</button>
							{heartRateData.length > 0 && (
								<button
									className="control-button export"
									onClick={exportSession}
									disabled={isMonitoring}
								>
									Export Data
								</button>
							)}
							{isMonitoring && (
								<div className="session-timer">
									Session Time: {formatDuration(sessionDuration)}
								</div>
							)}
						</div>

						<div className="hrv-chart">
							<h3>Heart Rate Trend</h3>
							<div style={{ height: "300px" }}>
								<Line ref={chartRef} data={chartData} options={chartOptions} />
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default LiveMonitor;
