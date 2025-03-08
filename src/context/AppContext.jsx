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
	const recordingTimeoutRef = useRef(null);

	// Refs to prevent duplicate event listeners and track initialization
	const eventListenersSet = useRef(false);
	const initializationInProgress = useRef(false);
	const isInitialized = useRef(false);

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

	// Setup event listeners once
	const setupEventListeners = useCallback(() => {
		if (eventListenersSet.current) {
			console.log("Event listeners already set up");
			return;
		}

		console.log("Setting up event listeners");
		connectionService.on(
			"connectionStatusChanged",
			handleConnectionStatusChanged
		);
		connectionService.on("devicesPaired", handleDevicesPaired);
		connectionService.on("heartRateData", handleHeartRateData);

		eventListenersSet.current = true;
	}, [handleConnectionStatusChanged, handleDevicesPaired, handleHeartRateData]);

	// Cleanup function
	const cleanup = useCallback(() => {
		console.log("Cleaning up AppContext");
		if (recordingTimeoutRef.current) {
			clearTimeout(recordingTimeoutRef.current);
		}

		// Remove event listeners
		if (eventListenersSet.current) {
			connectionService.off(
				"connectionStatusChanged",
				handleConnectionStatusChanged
			);
			connectionService.off("devicesPaired", handleDevicesPaired);
			connectionService.off("heartRateData", handleHeartRateData);
			eventListenersSet.current = false;
		}

		// Reset state
		setIsRecording(false);
		setCameraFrame(null);
		setHeartRateData([]);
		setCurrentHeartRate(0);
		setHrvMetrics({
			sdnn: 0,
			rmssd: 0,
			lf: 0,
			hf: 0,
			lfhf: 0,
		});
		setLastFrameTime(null);
		setConnectionStatus("disconnected");
		setDeviceInfo(null);

		// Reset refs
		isInitialized.current = false;
		initializationInProgress.current = false;
	}, [handleConnectionStatusChanged, handleDevicesPaired, handleHeartRateData]);

	// Initialize connection service
	const initializeConnection = useCallback(
		async (newSessionId, deviceType) => {
			if (!newSessionId || initializationInProgress.current) {
				console.log(
					"Initialization skipped - already in progress or no session ID"
				);
				return false;
			}

			if (isInitialized.current && sessionId === newSessionId) {
				console.log("Already initialized with this session ID");
				return true;
			}

			try {
				console.log("Initializing connection:", newSessionId, deviceType);
				initializationInProgress.current = true;
				setupEventListeners();

				const success = await connectionService.initialize(
					newSessionId,
					deviceType
				);
				if (success) {
					setSessionId(newSessionId);
					localStorage.setItem("cardboardhrv-session-id", newSessionId);
					isInitialized.current = true;
					return true;
				}
				return false;
			} catch (error) {
				console.error("Error initializing connection:", error);
				return false;
			} finally {
				initializationInProgress.current = false;
			}
		},
		[setupEventListeners, sessionId]
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			cleanup();
		};
	}, [cleanup]);

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
		syncRecordingStatus,
		cleanup,
	};

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Create a custom hook
const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useAppContext must be used within an AppProvider");
	}
	return context;
};

// Export both the Provider and the hook
export { AppProvider, useAppContext };
