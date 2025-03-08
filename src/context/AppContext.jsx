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
	const [sessionId, setSessionId] = useState(() => {
		// Initialize sessionId from localStorage
		return localStorage.getItem("cardboardhrv-session-id") || "";
	});
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [deviceInfo, setDeviceInfo] = useState(null);
	const [cameraFrame, setCameraFrame] = useState(null);
	const [lastFrameTime, setLastFrameTime] = useState(null);
	const [isRecording, setIsRecording] = useState(false);

	// Effect to handle initial connection setup
	useEffect(() => {
		if (sessionId) {
			// Determine device type from URL
			const isMobilePath = window.location.pathname.includes("/mobile");
			const deviceType = isMobilePath ? "mobile" : "desktop";

			// Attempt to reconnect with stored session
			initializeConnection(sessionId, deviceType);
		}

		// Cleanup on unmount
		return () => {
			cleanup();
		};
	}, []);

	// Handle connection status changes
	const handleConnectionStatusChanged = (data) => {
		setConnectionStatus(data.status);
		setIsConnected(data.status === "connected");

		// Store connection status in localStorage
		localStorage.setItem("cardboardhrv-connection-status", data.status);
	};

	// Handle devices paired event
	const handleDevicesPaired = (data) => {
		setDeviceInfo(data);
		// Store device info in localStorage
		localStorage.setItem("cardboardhrv-device-info", JSON.stringify(data));
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

		// Set up event listeners before initializing
		connectionService.on(
			"connectionStatusChanged",
			handleConnectionStatusChanged
		);
		connectionService.on("devicesPaired", handleDevicesPaired);
		connectionService.on("heartRateData", handleHeartRateData);

		const success = await connectionService.initialize(
			newSessionId,
			deviceType
		);
		if (success) {
			setSessionId(newSessionId);
			localStorage.setItem("cardboardhrv-session-id", newSessionId);

			// Try to restore device info from localStorage
			const storedDeviceInfo = localStorage.getItem("cardboardhrv-device-info");
			if (storedDeviceInfo) {
				try {
					const parsedDeviceInfo = JSON.parse(storedDeviceInfo);
					setDeviceInfo(parsedDeviceInfo);
				} catch (error) {
					console.error("Error parsing stored device info:", error);
				}
			}

			return true;
		}
		return false;
	};

	// Clean up function
	const cleanup = () => {
		// Remove event listeners
		connectionService.off(
			"connectionStatusChanged",
			handleConnectionStatusChanged
		);
		connectionService.off("devicesPaired", handleDevicesPaired);
		connectionService.off("heartRateData", handleHeartRateData);

		// Clear timeouts
		clearTimeout(window.recordingTimeout);
	};

	// Handle visibility change
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden && sessionId) {
				// Determine device type from URL
				const isMobilePath = window.location.pathname.includes("/mobile");
				const deviceType = isMobilePath ? "mobile" : "desktop";

				// Attempt to reconnect
				initializeConnection(sessionId, deviceType);
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [sessionId]);

	// Handle beforeunload
	useEffect(() => {
		const handleBeforeUnload = () => {
			// Store current state in localStorage
			if (deviceInfo) {
				localStorage.setItem(
					"cardboardhrv-device-info",
					JSON.stringify(deviceInfo)
				);
			}
			localStorage.setItem("cardboardhrv-connection-status", connectionStatus);
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [deviceInfo, connectionStatus]);

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
