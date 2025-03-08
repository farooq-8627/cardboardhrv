import React, { createContext, useContext, useState, useEffect } from "react";
import connectionService from "../utils/connectionService";

const AppContext = createContext();

export function useAppContext() {
	return useContext(AppContext);
}

export function AppProvider({ children }) {
	const [isConnected, setIsConnected] = useState(false);
	const [heartRateData, setHeartRateData] = useState([]);
	const [currentHeartRate, setCurrentHeartRate] = useState(0);
	const [hrvMetrics, setHrvMetrics] = useState({
		sdnn: 0,
		rmssd: 0,
		lf: 0,
		hf: 0,
		lfhf: 0,
	});
	const [sessionId, setSessionId] = useState("");
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [deviceInfo, setDeviceInfo] = useState(null);
	const [cameraFrame, setCameraFrame] = useState(null);
	const [lastFrameTime, setLastFrameTime] = useState(null);
	const [isRecording, setIsRecording] = useState(false);

	// Handle connection status changes
	const handleConnectionStatusChanged = (data) => {
		setConnectionStatus(data.status);
		setIsConnected(data.status === "connected");
	};

	// Handle devices paired event
	const handleDevicesPaired = (data) => {
		setDeviceInfo(data);
	};

	// Handle heart rate data
	const handleHeartRateData = (data) => {
		setCurrentHeartRate(data.heartRate);
		setHeartRateData((prev) => {
			const newData = [
				...prev,
				{
					timestamp: data.timestamp,
					value: data.heartRate,
				},
			];
			return newData.slice(-60); // Keep last 60 data points
		});

		// Calculate HRV metrics
		if (heartRateData.length > 1) {
			const lastHR = heartRateData[heartRateData.length - 1].value;
			const currentHR = data.heartRate;
			const lastRR = 60000 / lastHR;
			const currentRR = 60000 / currentHR;
			const diff = Math.abs(currentRR - lastRR);
			const hrv = Math.sqrt(diff * diff);

			setHrvMetrics((prev) => ({
				...prev,
				rmssd: Math.round(hrv),
			}));
		}
	};

	// Handle camera frame data
	const handleCameraFrame = (data) => {
		if (data.imageData) {
			setCameraFrame(data.imageData);
			setLastFrameTime(data.timestamp);
			setIsRecording(true);

			// Reset recording status if no frames received for 5 seconds
			clearTimeout(window.recordingTimeout);
			window.recordingTimeout = setTimeout(() => {
				setIsRecording(false);
			}, 5000);
		}
	};

	// Initialize connection service
	const initializeConnection = async (newSessionId, deviceType) => {
		if (!newSessionId) return false;

		const success = await connectionService.initialize(
			newSessionId,
			deviceType
		);
		if (success) {
			setSessionId(newSessionId);
			return true;
		}
		return false;
	};

	// Clean up function
	const cleanup = () => {
		connectionService.off(
			"connectionStatusChanged",
			handleConnectionStatusChanged
		);
		connectionService.off("devicesPaired", handleDevicesPaired);
		connectionService.off("heartRateData", handleHeartRateData);
		clearTimeout(window.recordingTimeout);
	};

	const value = {
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
	};

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
