import { useState, useEffect } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Link,
	useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveMonitor from "./components/LiveMonitor";
import ConnectPhone from "./components/ConnectPhone";
import ProjectInfo from "./components/ProjectInfo";
import ConnectMobile from "./components/ConnectMobile";
import connectionService from "./utils/connectionService";
import "./App.css";

function App() {
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
	const [connectedSessionId, setConnectedSessionId] = useState(null);
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [deviceInfo, setDeviceInfo] = useState(null);

	// Initialize connection service and set up event listeners
	useEffect(() => {
		// Generate or retrieve a persistent session ID
		let persistentSessionId;
		try {
			persistentSessionId = localStorage.getItem("cardboardhrv-session-id");
			if (!persistentSessionId) {
				persistentSessionId = generateSessionId();
				localStorage.setItem("cardboardhrv-session-id", persistentSessionId);
			}
			setSessionId(persistentSessionId);
		} catch (e) {
			console.error("Failed to use localStorage for session ID:", e);
			const newSessionId = generateSessionId();
			setSessionId(newSessionId);
		}

		// Check URL parameters for direct connection
		const urlParams = new URLSearchParams(window.location.search);
		const directConnect = urlParams.get("directConnect");
		const urlSessionId = urlParams.get("sessionId");

		if (directConnect === "true" && urlSessionId) {
			console.log("Direct connection parameters found in URL:", urlSessionId);
			setSessionId(urlSessionId);
			persistentSessionId = urlSessionId;
		}

		// Initialize connection service
		const initializeConnection = async () => {
			if (!persistentSessionId) return;

			// Determine if this is a mobile device
			const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
			const deviceType = isMobile ? "mobile" : "desktop";

			// Initialize connection service
			const success = await connectionService.initialize(
				persistentSessionId,
				deviceType
			);
			if (success) {
				console.log(`Initialized connection service as ${deviceType}`);
			} else {
				console.error("Failed to initialize connection service");
			}

			// Set up event listeners
			connectionService.on(
				"connectionStatusChanged",
				handleConnectionStatusChanged
			);
			connectionService.on("devicesPaired", handleDevicesPaired);
			connectionService.on("deviceDisconnected", handleDeviceDisconnected);
			connectionService.on("heartRateData", handleHeartRateData);
			connectionService.on("message", handleMessage);

			// If this is a direct connection, generate initial data
			if (directConnect === "true") {
				generateInitialData();
			}
		};

		initializeConnection();

		// Clean up event listeners
		return () => {
			connectionService.off(
				"connectionStatusChanged",
				handleConnectionStatusChanged
			);
			connectionService.off("devicesPaired", handleDevicesPaired);
			connectionService.off("deviceDisconnected", handleDeviceDisconnected);
			connectionService.off("heartRateData", handleHeartRateData);
			connectionService.off("message", handleMessage);

			// Disconnect from the session
			connectionService.disconnect();
		};
	}, []);

	// Handle connection status changes
	const handleConnectionStatusChanged = (data) => {
		console.log("Connection status changed:", data.status);
		setConnectionStatus(data.status);
	};

	// Handle devices paired event
	const handleDevicesPaired = (data) => {
		console.log("Devices paired:", data);
		setIsConnected(true);
		setConnectedSessionId(sessionId);
		setDeviceInfo(data);
	};

	// Handle device disconnected event
	const handleDeviceDisconnected = (data) => {
		console.log("Device disconnected:", data);
		if (!data.isMobileConnected || !data.isDesktopConnected) {
			setIsConnected(false);
			setDeviceInfo(null);
		}
	};

	// Handle heart rate data event
	const handleHeartRateData = (data) => {
		console.log("Heart rate data received:", data);
		processHeartRateData(data);
	};

	// Handle message event
	const handleMessage = (data) => {
		console.log("Message received:", data);
		// Handle messages as needed
	};

	// Function to process heart rate data
	const processHeartRateData = (data) => {
		// Update current heart rate
		setCurrentHeartRate(data.heartRate);

		// Add to heart rate data array
		const newDataPoint = {
			timestamp: new Date(data.timestamp),
			heartRate: data.heartRate,
			rawData: data.rawData || 0,
		};

		setHeartRateData((prevData) => {
			// Keep only the last 60 seconds of data (assuming 1 data point per second)
			const newData = [...prevData, newDataPoint];
			if (newData.length > 60) {
				return newData.slice(newData.length - 60);
			}
			return newData;
		});

		// Calculate HRV metrics
		calculateHRVMetrics(data.heartRate);
	};

	// Function to calculate HRV metrics
	const calculateHRVMetrics = (heartRate) => {
		// In a real implementation, this would use proper HRV calculation algorithms
		// For this demo, we'll use simplified calculations

		// Generate some random variations for demo purposes
		const randomVariation = () => Math.random() * 0.2 + 0.9; // 0.9 to 1.1

		setHrvMetrics((prevMetrics) => ({
			sdnn: Math.round(heartRate * 0.1 * randomVariation()),
			rmssd: Math.round(heartRate * 0.15 * randomVariation()),
			lf: Math.round(heartRate * 0.5 * randomVariation()),
			hf: Math.round(heartRate * 0.3 * randomVariation()),
			lfhf: parseFloat((randomVariation() * 1.5).toFixed(2)),
		}));
	};

	// Function to generate a unique session ID
	const generateSessionId = () => {
		return Math.random().toString(36).substring(2, 10);
	};

	// Function to connect to a mobile device
	const connectToBackend = (deviceId) => {
		console.log("Connecting to device:", deviceId);
		// In a real implementation, this would establish a connection to the device
		// For this demo, we'll simulate a successful connection
		setIsConnected(true);
		setConnectedSessionId(deviceId);
	};

	// Function to send a message to the connected mobile device
	const sendMessageToMobile = (message) => {
		return connectionService.sendMessage(message);
	};

	// Function to generate initial data for direct connections
	const generateInitialData = () => {
		// Generate some initial heart rate data
		const initialData = [];
		const now = new Date();

		// Generate data points for the last 30 seconds
		for (let i = 30; i >= 0; i--) {
			const timestamp = new Date(now.getTime() - i * 1000);
			const heartRate = Math.floor(60 + Math.random() * 30);

			initialData.push({
				timestamp,
				heartRate,
				rawData: Math.random() * 100,
			});
		}

		// Set the heart rate data
		setHeartRateData(initialData);

		// Set the current heart rate to the latest value
		if (initialData.length > 0) {
			setCurrentHeartRate(initialData[initialData.length - 1].heartRate);

			// Calculate HRV metrics
			calculateHRVMetrics(initialData[initialData.length - 1].heartRate);
		}

		// Set up a timer to simulate ongoing data
		const dataInterval = setInterval(() => {
			const newHeartRate = Math.floor(60 + Math.random() * 30);

			// Add a new data point
			const newDataPoint = {
				timestamp: new Date(),
				heartRate: newHeartRate,
				rawData: Math.random() * 100,
			};

			// Update the heart rate data
			setHeartRateData((prevData) => {
				const newData = [...prevData, newDataPoint];
				if (newData.length > 60) {
					return newData.slice(newData.length - 60);
				}
				return newData;
			});

			// Update the current heart rate
			setCurrentHeartRate(newHeartRate);

			// Calculate HRV metrics
			calculateHRVMetrics(newHeartRate);

			// Send heart rate data to the connection service
			connectionService.sendHeartRateData({
				heartRate: newHeartRate,
				rawData: Math.random() * 100,
			});
		}, 1000);

		// Store the interval ID for cleanup
		window.cardboardHrvDataInterval = dataInterval;

		// Return a cleanup function
		return () => {
			clearInterval(dataInterval);
			window.cardboardHrvDataInterval = null;
		};
	};

	return (
		<Router>
			<div className="app-container">
				<Header />
				<main className="main-content">
					<Routes>
						<Route
							path="/"
							element={
								<div className="home-container">
									<div className="hero-section">
										<h1>CardboardHRV</h1>
										<h2>
											Heart Rate Variability Monitoring with Your Smartphone
										</h2>
										<p>
											Transform your smartphone into a heart rate monitor using
											just your phone's camera and a simple cardboard
											attachment.
										</p>
										<Link to="/connect" className="cta-button">
											Get Started
										</Link>
									</div>
								</div>
							}
						/>
						<Route
							path="/monitor"
							element={
								<LiveMonitor
									isConnected={isConnected}
									heartRateData={heartRateData}
									currentHeartRate={currentHeartRate}
									hrvMetrics={hrvMetrics}
									sendMessageToMobile={sendMessageToMobile}
									connectionStatus={connectionStatus}
									deviceInfo={deviceInfo}
								/>
							}
						/>
						<Route
							path="/connect"
							element={
								<ConnectPhone
									isConnected={isConnected}
									onConnect={connectToBackend}
									sessionId={sessionId}
									connectedSessionId={connectedSessionId}
									connectionStatus={connectionStatus}
									deviceInfo={deviceInfo}
								/>
							}
						/>
						<Route path="/info" element={<ProjectInfo />} />
						<Route path="/mobile" element={<ConnectMobile />} />
					</Routes>
				</main>
				<Footer />
			</div>
		</Router>
	);
}

export default App;
