import React from "react";
import { Link } from "react-router-dom";
import HRVChart from "./HRVChart";

function LiveMonitor({
	isConnected,
	heartRateData,
	currentHeartRate,
	hrvMetrics,
}) {
	return (
		<div className="live-monitor">
			<h2>Live Heart Rate Monitoring</h2>

			{!isConnected ? (
				<div className="not-connected">
					<p>Please connect your phone to begin monitoring.</p>
					<Link to="/connect" className="cta-button">
						Connect Phone
					</Link>
				</div>
			) : (
				<div className="monitoring-container">
					<div className="vital-cards">
						<div className="vital-card heart-rate">
							<h3>Heart Rate</h3>
							<div className="heart-rate-value">
								<span className="value">{currentHeartRate}</span>
								<span className="unit">BPM</span>
							</div>
							<div className="heart-animation">
								{/* Heart animation that beats according to heart rate */}
								<div
									className="heart"
									style={{ animationDuration: `${60 / currentHeartRate}s` }}
								></div>
							</div>
						</div>

						<div className="vital-card hrv-metrics">
							<h3>HRV Metrics</h3>
							<div className="metrics-grid">
								<div className="metric">
									<span className="metric-name">RMSSD</span>
									<span className="metric-value">
										{hrvMetrics.rmssd.toFixed(1)}
									</span>
								</div>
								<div className="metric">
									<span className="metric-name">SDNN</span>
									<span className="metric-value">
										{hrvMetrics.sdnn.toFixed(1)}
									</span>
								</div>
								<div className="metric">
									<span className="metric-name">pNN50</span>
									<span className="metric-value">
										{hrvMetrics.pnn50.toFixed(1)}%
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="chart-container">
						<HRVChart data={heartRateData} />
					</div>

					<div className="session-controls">
						<button className="control-button start">Start Session</button>
						<button className="control-button stop">End Session</button>
						<button className="control-button export">Export Data</button>
					</div>
				</div>
			)}
		</div>
	);
}

export default LiveMonitor;
