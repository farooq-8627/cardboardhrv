import { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveMonitor from "./components/LiveMonitor";
import ConnectPhone from "./components/ConnectPhone";
import ProjectInfo from "./components/ProjectInfo";
import ConnectMobile from "./components/ConnectMobile";
import websocketService from "./utils/websocketService";
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
	const connectionTimeoutRef = useRef(null);

	// Initialize WebSocket service and set up event listeners
	useEffect(() => {
		// Initialize the WebSocket service
		websocketService.initialize();

		// Generate a unique session ID
		const newSessionId = generateSessionId();
		setSessionId(newSessionId);

		// Set up event listeners for WebSocket events
		websocketService.on("session", handleSessionEvent);
		websocketService.on("message", handleMessageEvent);
		websocketService.on("close", handleCloseEvent);

		// Set up event listeners for custom events from mobile device
		const handleMobileConnect = (event) => {
			console.log("Mobile device connected:", event.detail);
			if (event.detail.sessionId === sessionId) {
				setIsConnected(true);
				setConnectedSessionId(event.detail.sessionId);
				console.log("Mobile device connected with matching session ID!");

				// Clear any existing timeout
				if (connectionTimeoutRef.current) {
					clearTimeout(connectionTimeoutRef.current);
				}
			}
		};

		const handleMobileMessage = (event) => {
			console.log("Received message from mobile device:", event.detail);
			try {
				const data = JSON.parse(event.detail.data);
				if (data.type === "heartRateData" && data.sessionId === sessionId) {
					processHeartRateData(data);

					// Reset the connection timeout whenever we receive data
					if (connectionTimeoutRef.current) {
						clearTimeout(connectionTimeoutRef.current);
					}

					// Set a new timeout - if we don't receive data for 10 seconds, consider the connection lost
					connectionTimeoutRef.current = setTimeout(() => {
						console.log("Connection timeout - no data received for 10 seconds");
						setIsConnected(false);
						setConnectedSessionId(null);
					}, 10000);
				} else if (
					data.type === "connectionStatus" &&
					data.sessionId === sessionId
				) {
					console.log("Connection status update:", data.message);
					// This is a direct status update from the mobile device
					setIsConnected(true);
					setConnectedSessionId(data.sessionId);
				} else if (data.type === "ping" && data.sessionId === sessionId) {
					// Reset the connection timeout on ping
					if (connectionTimeoutRef.current) {
						clearTimeout(connectionTimeoutRef.current);
					}

					connectionTimeoutRef.current = setTimeout(() => {
						console.log("Connection timeout - no data received for 10 seconds");
						setIsConnected(false);
						setConnectedSessionId(null);
					}, 10000);
				}
			} catch (error) {
				console.error("Error processing mobile message:", error);
			}
		};

		const handleMobileDisconnect = (event) => {
			console.log("Mobile device disconnected:", event.detail);
			if (event.detail.sessionId === sessionId) {
				setIsConnected(false);
				setConnectedSessionId(null);

				// Clear the connection timeout
				if (connectionTimeoutRef.current) {
					clearTimeout(connectionTimeoutRef.current);
					connectionTimeoutRef.current = null;
				}
			}
		};

		window.addEventListener("cardboardhrv-mobile-connect", handleMobileConnect);
		window.addEventListener("cardboardhrv-mobile-message", handleMobileMessage);
		window.addEventListener(
			"cardboardhrv-mobile-close",
			handleMobileDisconnect
		);
		window.addEventListener(
			"cardboardhrv-mobile-disconnect",
			handleMobileDisconnect
		);

		return () => {
			// Clean up WebSocket service
			websocketService.off("session", handleSessionEvent);
			websocketService.off("message", handleMessageEvent);
			websocketService.off("close", handleCloseEvent);
			websocketService.cleanup();

			// Remove custom event listeners
			window.removeEventListener(
				"cardboardhrv-mobile-connect",
				handleMobileConnect
			);
			window.removeEventListener(
				"cardboardhrv-mobile-message",
				handleMobileMessage
			);
			window.removeEventListener(
				"cardboardhrv-mobile-close",
				handleMobileDisconnect
			);
			window.removeEventListener(
				"cardboardhrv-mobile-disconnect",
				handleMobileDisconnect
			);

			// Clear any timeouts
			if (connectionTimeoutRef.current) {
				clearTimeout(connectionTimeoutRef.current);
			}
		};
	}, [sessionId]);

	// Handle session event (mobile device connected with session ID)
	const handleSessionEvent = (event) => {
		console.log("Session event:", event);
		if (event.sessionId === sessionId) {
			setIsConnected(true);
			setConnectedSessionId(event.sessionId);
			console.log("Mobile device connected with matching session ID!");
		}
	};

	// Handle message event (data from mobile device)
	const handleMessageEvent = (event) => {
		console.log("Message event:", event);
		if (
			event.client.sessionId === sessionId &&
			event.data.type === "heartRateData"
		) {
			processHeartRateData(event.data);
		}
	};

	// Handle close event (mobile device disconnected)
	const handleCloseEvent = (event) => {
		console.log("Close event:", event);
		if (event.client.sessionId === sessionId) {
			setIsConnected(false);
			setConnectedSessionId(null);
		}
	};

	// Function to process heart rate data from mobile device
	const processHeartRateData = (data) => {
		// Update current heart rate
		setCurrentHeartRate(data.heartRate);

		// Add to heart rate data array
		const newDataPoint = {
			timestamp: new Date(data.timestamp),
			heartRate: data.heartRate,
			rawData: data.rawData,
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
		if (connectedSessionId) {
			window.dispatchEvent(
				new CustomEvent("cardboardhrv-main-message", {
					detail: {
						data: JSON.stringify({
							type: "connectionStatus",
							sessionId: connectedSessionId,
							message: message,
						}),
					},
				})
			);
			return true;
		}
		return false;
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
