import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	useRef,
} from "react";
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import connectionService from "../utils/connectionService";

// Initialize Firebase first
const firebaseConfig = {
	apiKey: "AIzaSyDQzEMQtT9afQiMlK-31GxJst9iqK4_8Gg",
	authDomain: "cardboardhrv.firebaseapp.com",
	databaseURL:
		"https://cardboardhrv-default-rtdb.asia-southeast1.firebasedatabase.app",
	projectId: "cardboardhrv",
	storageBucket: "cardboardhrv.appspot.com",
	messagingSenderId: "1098040621778",
	appId: "1:1098040621778:web:5f9e3a5f1c9b5e5e5e5e5e",
};

try {
	initializeApp(firebaseConfig);
	getDatabase();
} catch (error) {
	console.error("Error initializing Firebase:", error);
}

const AppContext = createContext();

// Create a separate Provider component
const AppProvider = ({ children }) => {
	const [isConnected, setIsConnected] = useState(() => {
		return (
			localStorage.getItem("cardboardhrv-connection-status") === "connected"
		);
	});
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
		return localStorage.getItem("cardboardhrv-session-id") || "";
	});
	const [connectionStatus, setConnectionStatus] = useState(() => {
		return (
			localStorage.getItem("cardboardhrv-connection-status") || "disconnected"
		);
	});
	const [deviceInfo, setDeviceInfo] = useState(() => {
		const stored = localStorage.getItem("cardboardhrv-device-info");
		return stored ? JSON.parse(stored) : null;
	});
	const [cameraFrame, setCameraFrame] = useState(null);
	const [lastFrameTime, setLastFrameTime] = useState(null);
	const [isRecording, setIsRecording] = useState(false);

	// Additional biometric data for the enhanced monitor
	const [biometrics, setBiometrics] = useState({
		bloodPressure: { systolic: 0, diastolic: 0 },
		oxygenLevel: 0,
		temperature: 0,
		respirationRate: 0,
	});

	// History for biometric data
	const [biometricsHistory, setBiometricsHistory] = useState({
		heartRate: [],
		systolic: [],
		diastolic: [],
		oxygenLevel: [],
		temperature: [],
		respirationRate: [],
	});

	const recordingTimeoutRef = useRef(null);

	// Refs to prevent duplicate event listeners and track initialization
	const eventListenersSet = useRef(false);
	const initializationInProgress = useRef(false);
	const isInitialized = useRef(false);
	const simulationIntervalRef = useRef(null);

	// Helper function to simulate realistic biometric fluctuations
	const simulateValue = (current, min, max, maxChange) => {
		// Random change within maxChange range
		const change = Math.random() * maxChange * 2 - maxChange;
		let newValue = current + change;

		// Keep within realistic bounds
		if (newValue < min) newValue = min;
		if (newValue > max) newValue = max;

		return Number(newValue.toFixed(1));
	};

	// Simulate biometric data when connected
	useEffect(() => {
		if (connectionStatus === "connected") {
			// Initialize with realistic starting values if not already set
			if (biometrics.bloodPressure.systolic === 0) {
				setBiometrics({
					bloodPressure: { systolic: 120, diastolic: 80 },
					oxygenLevel: 98,
					temperature: 37.0,
					respirationRate: 14,
				});
			}

			// Set up interval for simulating data
			simulationIntervalRef.current = setInterval(() => {
				// Update biometrics with simulated values
				setBiometrics((prev) => ({
					bloodPressure: {
						systolic: simulateValue(prev.bloodPressure.systolic, 110, 140, 3),
						diastolic: simulateValue(prev.bloodPressure.diastolic, 70, 90, 2),
					},
					oxygenLevel: simulateValue(prev.oxygenLevel, 95, 100, 1),
					temperature: simulateValue(prev.temperature, 36.5, 37.5, 0.1),
					respirationRate: simulateValue(prev.respirationRate, 12, 20, 1),
				}));

				// If no real heart rate data, simulate it
				if (
					!heartRateData.length ||
					Date.now() - heartRateData[heartRateData.length - 1]?.timestamp > 5000
				) {
					const simulatedHR = currentHeartRate
						? simulateValue(currentHeartRate, 60, 100, 2)
						: Math.floor(Math.random() * 20) + 70; // 70-90 range

					setCurrentHeartRate(simulatedHR);

					// Add to heart rate data
					const timestamp = Date.now();
					setHeartRateData((prev) => {
						const newData = [
							...prev,
							{
								timestamp,
								value: simulatedHR,
								ppg: Math.random(), // Simulated PPG value
							},
						];
						return newData.slice(-60); // Keep last 60 readings
					});

					// Update HRV metrics with simulated values
					setHrvMetrics({
						sdnn: Math.floor(Math.random() * 30) + 30, // 30-60 range
						rmssd: Math.floor(Math.random() * 20) + 20, // 20-40 range
						lf: Math.floor(Math.random() * 500) + 500, // 500-1000 range
						hf: Math.floor(Math.random() * 500) + 200, // 200-700 range
						lfhf: Number((Math.random() * 2 + 1).toFixed(1)), // 1.0-3.0 range
					});
				}

				// Update history
				setBiometricsHistory((prev) => {
					const maxHistoryLength = 10;
					return {
						heartRate: [...prev.heartRate, currentHeartRate].slice(
							-maxHistoryLength
						),
						systolic: [
							...prev.systolic,
							biometrics.bloodPressure.systolic,
						].slice(-maxHistoryLength),
						diastolic: [
							...prev.diastolic,
							biometrics.bloodPressure.diastolic,
						].slice(-maxHistoryLength),
						oxygenLevel: [...prev.oxygenLevel, biometrics.oxygenLevel].slice(
							-maxHistoryLength
						),
						temperature: [...prev.temperature, biometrics.temperature].slice(
							-maxHistoryLength
						),
						respirationRate: [
							...prev.respirationRate,
							biometrics.respirationRate,
						].slice(-maxHistoryLength),
					};
				});
			}, 2000);
		}

		return () => {
			if (simulationIntervalRef.current) {
				clearInterval(simulationIntervalRef.current);
			}
		};
	}, [connectionStatus, currentHeartRate, heartRateData]);

	// Memoize event handlers
	const handleConnectionStatusChanged = useCallback((data) => {
		console.log("Connection status changed:", data.status);
		setConnectionStatus(data.status);
		setIsConnected(data.status === "connected");
		localStorage.setItem("cardboardhrv-connection-status", data.status);
	}, []);

	const handleDevicesPaired = useCallback((data) => {
		console.log("Devices paired:", data);
		setDeviceInfo(data);
		localStorage.setItem("cardboardhrv-device-info", JSON.stringify(data));
		setConnectionStatus("connected");
		setIsConnected(true);
		localStorage.setItem("cardboardhrv-connection-status", "connected");
	}, []);

	const handleHeartRateData = useCallback((data) => {
		if (!data || typeof data.heartRate !== "number") {
			console.warn("Invalid heart rate data received:", data);
			return;
		}

		setCurrentHeartRate(data.heartRate);
		setHeartRateData((prev) => {
			if (!Array.isArray(prev)) prev = [];
			const newData = [
				...prev,
				{
					timestamp: data.timestamp || Date.now(),
					value: data.heartRate,
					ppg: data.ppgValue,
				},
			];
			return newData.slice(-60);
		});

		setHrvMetrics((prev) => {
			if (!prev || typeof prev !== "object") {
				return { sdnn: 0, rmssd: 0, lf: 0, hf: 0, lfhf: 0 };
			}

			if (prev.value) {
				const lastHR = prev.value;
				const currentHR = data.heartRate;
				const lastRR = 60000 / lastHR;
				const currentRR = 60000 / currentHR;
				const diff = Math.abs(currentRR - lastRR);
				const hrv = Math.sqrt(diff * diff);
				return { ...prev, rmssd: Math.round(hrv) };
			}
			return prev;
		});
	}, []);

	// Function to sync recording status across components
	const syncRecordingStatus = useCallback((status) => {
		setIsRecording(status);
		if (status) {
			localStorage.setItem("cardboardhrv-was-recording", "true");
		} else {
			localStorage.removeItem("cardboardhrv-was-recording");
		}
	}, []);

	// Handle camera frame with improved error handling and status management
	const handleCameraFrame = useCallback(
		(frameData) => {
			if (!frameData) {
				console.error("No frame data received");
				return;
			}

			const { imageData, timestamp, deviceId } = frameData;

			// Log frame receipt with timestamp
			console.log(
				`Received frame from ${deviceId} at ${new Date(
					timestamp
				).toLocaleTimeString()}`
			);

			try {
				// Update frame data
				if (imageData) {
					setCameraFrame(imageData);
					setLastFrameTime(timestamp);
					syncRecordingStatus(true);

					// Clear any existing timeout
					if (recordingTimeoutRef.current) {
						clearTimeout(recordingTimeoutRef.current);
					}

					// Set new timeout for marking as not recording
					recordingTimeoutRef.current = setTimeout(() => {
						const timeSinceLastFrame = Date.now() - lastFrameTime;
						if (timeSinceLastFrame > 2000) {
							console.log(
								"No frames received for 2 seconds, marking as not recording"
							);
							syncRecordingStatus(false);
							setCameraFrame(null);
						}
					}, 2000);
				} else {
					console.warn("Received frame data without imageData");
					syncRecordingStatus(false);
				}

				// Update heart rate data if available
				if (frameData.heartRate) {
					setHeartRateData((prev) => [
						...prev,
						{
							timestamp: timestamp,
							value: frameData.heartRate,
							ppg: frameData.ppgValue,
						},
					]);
				}
			} catch (error) {
				console.error("Error processing camera frame:", error);
				syncRecordingStatus(false);
			}
		},
		[lastFrameTime, syncRecordingStatus]
	);

	// Initialize connection service
	const initializeConnection = useCallback(
		async (sessionId, deviceType) => {
			if (initializationInProgress.current) {
				console.log("Initialization already in progress, skipping");
				return false;
			}

			if (isInitialized.current) {
				console.log("Already initialized, skipping");
				return true;
			}

			initializationInProgress.current = true;
			console.log("Initializing connection:", sessionId, deviceType);

			try {
				// Set up event listeners if not already set
				if (!eventListenersSet.current) {
					console.log("Setting up event listeners");
					connectionService.on(
						"connectionStatusChanged",
						handleConnectionStatusChanged
					);
					connectionService.on("devicesPaired", handleDevicesPaired);
					connectionService.on("heartRateData", handleHeartRateData);
					eventListenersSet.current = true;
				}

				// Initialize connection service
				const success = await connectionService.initialize(
					sessionId,
					deviceType
				);
				if (success) {
					console.log("Connection service initialized successfully");
					setSessionId(sessionId);
					localStorage.setItem("cardboardhrv-session-id", sessionId);
					isInitialized.current = true;
					initializationInProgress.current = false;
					return true;
				} else {
					console.error("Failed to initialize connection service");
					initializationInProgress.current = false;
					return false;
				}
			} catch (error) {
				console.error("Error initializing connection:", error);
				initializationInProgress.current = false;
				return false;
			}
		},
		[handleConnectionStatusChanged, handleDevicesPaired, handleHeartRateData]
	);

	// Cleanup function
	const cleanup = useCallback(() => {
		console.log("Cleaning up AppContext");
		if (eventListenersSet.current) {
			connectionService.off(
				"connectionStatusChanged",
				handleConnectionStatusChanged
			);
			connectionService.off("devicesPaired", handleDevicesPaired);
			connectionService.off("heartRateData", handleHeartRateData);
			eventListenersSet.current = false;
		}

		if (recordingTimeoutRef.current) {
			clearTimeout(recordingTimeoutRef.current);
			recordingTimeoutRef.current = null;
		}

		if (simulationIntervalRef.current) {
			clearInterval(simulationIntervalRef.current);
			simulationIntervalRef.current = null;
		}

		isInitialized.current = false;
		initializationInProgress.current = false;
	}, [handleConnectionStatusChanged, handleDevicesPaired, handleHeartRateData]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			cleanup();
		};
	}, [cleanup]);

	// Context value
	const contextValue = {
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
		syncRecordingStatus,
		biometrics,
		biometricsHistory,
	};

	return (
		<AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
	);
};

// Custom hook to use the context
const useAppContext = () => {
	return useContext(AppContext);
};

export { AppProvider, useAppContext };
