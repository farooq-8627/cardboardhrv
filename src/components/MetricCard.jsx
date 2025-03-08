import React from "react";

function MetricCard({
	title,
	value,
	unit,
	history,
	normalRange,
	isBP = false,
}) {
	return (
		<div className="metric-card">
			<h3>{title}</h3>
			<div className="current-value">
				<span className="value">{value}</span>
				<span className="unit">{unit}</span>
			</div>
			<div className="normal-range">Normal: {normalRange}</div>

			<div className="history-graph">
				{isBP ? (
					// Special case for blood pressure which has two values
					<>
						<div className="bp-graph">
							<div className="systolic-line">
								{history.systolic.map((val, i) => (
									<div
										key={`sys-${i}`}
										className="data-point systolic"
										style={{ height: `${((val - 70) / 100) * 100}%` }}
										title={`Systolic: ${val}`}
									/>
								))}
							</div>
							<div className="diastolic-line">
								{history.diastolic.map((val, i) => (
									<div
										key={`dia-${i}`}
										className="data-point diastolic"
										style={{ height: `${((val - 40) / 80) * 100}%` }}
										title={`Diastolic: ${val}`}
									/>
								))}
							</div>
						</div>
						<div className="legend">
							<span className="systolic-legend">Systolic</span>
							<span className="diastolic-legend">Diastolic</span>
						</div>
					</>
				) : (
					// Standard graph for other metrics
					<div className="graph-line">
						{Array.isArray(history) &&
							history.map((val, i) => {
								// Calculate height based on the metric type
								let heightPercentage;
								switch (title) {
									case "Heart Rate":
										heightPercentage = ((val - 50) / 70) * 100;
										break;
									case "Oxygen Saturation":
										heightPercentage = ((val - 90) / 10) * 100;
										break;
									case "Body Temperature":
										heightPercentage = ((val - 35) / 3) * 100;
										break;
									case "Respiration Rate":
										heightPercentage = ((val - 8) / 20) * 100;
										break;
									default:
										heightPercentage = val;
								}

								// Ensure height is within bounds
								heightPercentage = Math.max(0, Math.min(100, heightPercentage));

								return (
									<div
										key={i}
										className="data-point"
										style={{ height: `${heightPercentage}%` }}
										title={val}
									/>
								);
							})}
					</div>
				)}
			</div>
		</div>
	);
}

export default MetricCard;
