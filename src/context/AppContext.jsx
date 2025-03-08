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

// Combine the context hook and provider into a single export
export const AppContextProvider = {
	useAppContext: () => {
		const context = useContext(AppContext);
		if (!context) {
			throw new Error("useAppContext must be used within an AppProvider");
		}
		return context;
	},
	AppProvider: ({ children }) => {
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

		// Refs to prevent duplicate event listeners
		const eventListenersSet = useRef(false);
		const initializationInProgress = useRef(false);

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
			try {
				if (!data || typeof data.heartRate !== "number") {
					console.warn("Invalid heart rate data received:", data);
					return;
				}

				setCurrentHeartRate(data.heartRate);
				setHeartRateData((prev) => {
					if (!Array.isArray(prev)) prev = []; // Ensure prev is always an array
					const newData = [
						...prev,
						{
							timestamp: data.timestamp || Date.now(),
							value: data.heartRate,
							ppg: data.ppgValue,
						},
					];
					return newData.slice(-60); // Keep last 60 data points
				});

				setHrvMetrics((prev) => {
					if (!prev || typeof prev !== "object") {
						return {
							sdnn: 0,
							rmssd: 0,
							lf: 0,
							hf: 0,
							lfhf: 0,
						};
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
			} catch (error) {
				console.error("Error processing heart rate data:", error);
				// Don't update state if there's an error
			}
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

		// Cleanup function with improved resource management
		const cleanup = useCallback(() => {
			if (recordingTimeoutRef.current) {
				clearTimeout(recordingTimeoutRef.current);
			}
			syncRecordingStatus(false);
			setCameraFrame(null);
			setHeartRateData([]); // Ensure this is always an array
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
			eventListenersSet.current = false; // Reset event listeners flag
		}, [syncRecordingStatus]);

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
		}, [
			handleConnectionStatusChanged,
			handleDevicesPaired,
			handleHeartRateData,
		]);

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
				document.removeEventListener(
					"visibilitychange",
					handleVisibilityChange
				);
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
			syncRecordingStatus,
			cleanup,
		};

		return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
	},
};
