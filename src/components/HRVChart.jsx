import React, { useEffect, useRef } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
} from "recharts";

function HRVChart({ data }) {
	const chartContainerRef = useRef(null);

	// Format time for display on the chart
	const formatTime = (time) => {
		const date = new Date(time);
		return `${date.getMinutes()}:${date
			.getSeconds()
			.toString()
			.padStart(2, "0")}`;
	};

	const formatData = data.map((point) => ({
		...point,
		formattedTime: formatTime(point.time),
	}));

	return (
		<div className="hrv-chart" ref={chartContainerRef}>
			<h3>Real-time Heart Rate</h3>

			<ResponsiveContainer width="100%" height={300}>
				<LineChart
					data={formatData}
					margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
				>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis
						dataKey="formattedTime"
						label={{
							value: "Time",
							position: "insideBottomRight",
							offset: -10,
						}}
					/>
					<YAxis
						domain={[40, 140]}
						label={{ value: "BPM", angle: -90, position: "insideLeft" }}
					/>
					<Tooltip
						labelFormatter={(value) => `Time: ${value}`}
						formatter={(value) => [`${value} BPM`, "Heart Rate"]}
					/>
					<ReferenceLine y={60} stroke="#666" strokeDasharray="3 3" />
					<ReferenceLine y={100} stroke="#666" strokeDasharray="3 3" />
					<Line
						type="monotone"
						dataKey="value"
						stroke="#8884d8"
						strokeWidth={2}
						dot={false}
						activeDot={{ r: 8 }}
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

export default HRVChart;
