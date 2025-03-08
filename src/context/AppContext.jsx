import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	useRef,
} from "react";
import connectionService from "../utils/connectionService";

const AppContext = createContext();

export function useAppContext() {
	return useContext(AppContext);
}

export function AppProvider({ children }) {
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
	const [isRecording, setIsRecording] = useState(() => {
		return localStorage.getItem("cardboardhrv-was-recording") === "true";
	});

	// Refs to prevent duplicate event listeners
	const eventListenersSet = useRef(false);
	const initializationInProgress = useRef(false);
	const recordingTimeoutRef = useRef(null);

	// Memoize event handlers to prevent recreating them on each render
	const handleConnectionStatusChanged = useCallback((data) => {
		const newStatus = data.status;
		setConnectionStatus(newStatus);
		setIsConnected(newStatus === "connected");
		localStorage.setItem("cardboardhrv-connection-status", newStatus);
	}, []);

	const handleDevicesPaired = useCallback((data) => {
		setDeviceInfo(data);
		localStorage.setItem("cardboardhrv-device-info", JSON.stringify(data));
		// When devices are paired, ensure connection status is updated
		setConnectionStatus("connected");
		setIsConnected(true);
		localStorage.setItem("cardboardhrv-connection-status", "connected");
	}, []);

	const handleHeartRateData = useCallback((data) => {
		setCurrentHeartRate(data.heartRate);
		setHeartRateData((prev) => {
			const newData = [
				...prev,
				{ timestamp: data.timestamp, value: data.heartRate },
			];
			return newData.slice(-60);
		});

		setHrvMetrics((prev) => {
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

	const handleCameraFrame = useCallback((data) => {
		if (data.imageData) {
			console.log(
				"Frame received in context:",
				new Date(data.timestamp).toLocaleTimeString(),
				"from device:",
				data.deviceId
			);

			// Update frame immediately
			setCameraFrame(data.imageData);
			setLastFrameTime(data.timestamp);
			setIsRecording(true);
			localStorage.setItem("cardboardhrv-was-recording", "true");

			// Clear existing timeout
			if (recordingTimeoutRef.current) {
				clearTimeout(recordingTimeoutRef.current);
			}

			// Set new timeout for 2 seconds (reduced from 5 seconds)
			recordingTimeoutRef.current = setTimeout(() => {
				if (!document.hidden) {
					console.log(
						"No frames received for 2 seconds, marking as not recording"
					);
					setIsRecording(false);
					localStorage.setItem("cardboardhrv-was-recording", "false");
					// Clear the camera frame if no new frames received
					setCameraFrame(null);
				}
			}, 2000);
		} else {
			console.warn("Received camera frame data without imageData");
			setIsRecording(false);
			localStorage.setItem("cardboardhrv-was-recording", "false");
		}
	}, []);

	// Setup event listeners once
	const setupEventListeners = useCallback(() => {
		if (eventListenersSet.current) return;

		connectionService.on(
			"connectionStatusChanged",
			handleConnectionStatusChanged
		);
		connectionService.on("devicesPaired", handleDevicesPaired);
		connectionService.on("heartRateData", handleHeartRateData);

		eventListenersSet.current = true;
	}, [handleConnectionStatusChanged, handleDevicesPaired, handleHeartRateData]);

	// Initialize connection service
	const initializeConnection = useCallback(
		async (newSessionId, deviceType) => {
			if (!newSessionId || initializationInProgress.current) return false;

			try {
				initializationInProgress.current = true;
				setupEventListeners();

				const success = await connectionService.initialize(
					newSessionId,
					deviceType
				);
				if (success) {
					setSessionId(newSessionId);
					localStorage.setItem("cardboardhrv-session-id", newSessionId);
					return true;
				}
				return false;
			} finally {
				initializationInProgress.current = false;
			}
		},
		[setupEventListeners]
	);

	// Clean up function
	const cleanup = useCallback(() => {
		if (!eventListenersSet.current) return;

		connectionService.off(
			"connectionStatusChanged",
			handleConnectionStatusChanged
		);
		connectionService.off("devicesPaired", handleDevicesPaired);
		connectionService.off("heartRateData", handleHeartRateData);

		if (recordingTimeoutRef.current) {
			clearTimeout(recordingTimeoutRef.current);
		}
		eventListenersSet.current = false;
	}, [handleConnectionStatusChanged, handleDevicesPaired, handleHeartRateData]);

	// Initial connection setup and visibility change handler
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden && sessionId) {
				const isMobilePath = window.location.pathname.includes("/mobile");
				const deviceType = isMobilePath ? "mobile" : "desktop";

				// Only reinitialize if we're not already connected
				if (connectionStatus !== "connected") {
					initializeConnection(sessionId, deviceType);
				}
			}
		};

		// Initial setup
		if (sessionId && connectionStatus !== "connected") {
			const isMobilePath = window.location.pathname.includes("/mobile");
			const deviceType = isMobilePath ? "mobile" : "desktop";
			initializeConnection(sessionId, deviceType);
		}

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			cleanup();
		};
	}, [sessionId, connectionStatus, initializeConnection, cleanup]);

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
