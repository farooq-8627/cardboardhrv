import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode.react";
import connectionService from "../utils/connectionService";

function ConnectPhone() {
	const [sessionId, setSessionId] = useState("");
	const [qrValue, setQrValue] = useState("");
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [connectionInfo, setConnectionInfo] = useState("");
	const [deviceInfo, setDeviceInfo] = useState(null);
	const [showInstructions, setShowInstructions] = useState(true);

	// Initialize connection service when component mounts
	useEffect(() => {
		// Get the session ID from localStorage or generate a new one
		const storedSessionId = localStorage.getItem("cardboardhrv-session-id");
		const newSessionId = storedSessionId || generateSessionId();

		setSessionId(newSessionId);

		// Store the session ID in localStorage
		if (!storedSessionId) {
			localStorage.setItem("cardboardhrv-session-id", newSessionId);
		}

		// Generate QR code value
		const baseUrl = window.location.origin;
		const mobileUrl = `${baseUrl}/mobile?session=${newSessionId}`;
		setQrValue(mobileUrl);

		// Initialize connection service
		const initializeConnection = async () => {
			const success = await connectionService.initialize(
				newSessionId,
				"desktop"
			);
			if (success) {
				console.log(
					`Initialized connection service for session ${newSessionId}`
				);

				// Set up event listeners
				connectionService.on(
					"connectionStatusChanged",
					handleConnectionStatusChanged
				);
				connectionService.on("devicesPaired", handleDevicesPaired);
				connectionService.on("message", handleMessage);
			} else {
				console.error("Failed to initialize connection service");
				setConnectionInfo(
					"Failed to initialize connection service. Please try refreshing the page."
				);
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
			connectionService.off("message", handleMessage);

			// Don't disconnect from the session here, as we want to keep it active
			// when navigating to the monitor page
		};
	}, []);

	// Generate a random session ID
	const generateSessionId = () => {
		return Math.random().toString(36).substring(2, 10);
	};

	// Handle connection status changes
	const handleConnectionStatusChanged = (data) => {
		console.log("Connection status changed:", data.status);
		setConnectionStatus(data.status);
		setConnectionInfo(`Connection status: ${data.status}`);

		// If connected, hide instructions
		if (data.status === "connected") {
			setShowInstructions(false);
		}
	};

	// Handle devices paired event
	const handleDevicesPaired = (data) => {
		console.log("Devices paired:", data);
		setDeviceInfo(data);
		setConnectionInfo(`Connected to mobile device: ${data.mobileDeviceId}`);
		setShowInstructions(false);
	};

	// Handle message event
	const handleMessage = (data) => {
		console.log("Message received:", data);
		setConnectionInfo(`Message from mobile: ${data.text}`);
	};

	// Go to monitor page
	const goToMonitor = () => {
		window.location.href = `/monitor?sessionId=${sessionId}`;
	};

	return (
		<div className="connect-phone">
			<div className="section-title">
				<h1>Connect Your Phone</h1>
			</div>

			<div className="connection-container">
				<div className="qr-section card">
					<h2>Scan QR Code</h2>
					<p>Scan this QR code with your phone's camera to connect.</p>

					<div className="qr-code-container">
						<QRCode
							value={qrValue}
							size={200}
							level="H"
							includeMargin={true}
							renderAs="svg"
						/>
					</div>

					<div className="session-id-display">
						<p>
							Session ID: <strong>{sessionId}</strong>
						</p>
					</div>

					<div className="manual-connection">
						<h3>Manual Connection</h3>
						<p>Or open this URL on your phone:</p>
						<div className="url-display">
							<code>{qrValue}</code>
						</div>
					</div>
				</div>

				<div className="connection-status-section card">
					<h2>Connection Status</h2>

					<div className={`status-indicator ${connectionStatus}`}>
						<div className="status-dot"></div>
						<span className="status-text">
							{connectionStatus === "connected"
								? "Connected"
								: connectionStatus === "connecting"
								? "Connecting..."
								: connectionStatus === "disconnected"
								? "Disconnected"
								: "Unknown"}
						</span>
					</div>

					<p className="connection-info">{connectionInfo}</p>

					{deviceInfo && (
						<div className="device-info">
							<h3>Connected Device</h3>
							<p>
								<strong>Device ID:</strong> {deviceInfo.mobileDeviceId}
							</p>
							<p>
								<strong>Connected at:</strong>{" "}
								{new Date(deviceInfo.timestamp).toLocaleTimeString()}
							</p>
						</div>
					)}

					{connectionStatus === "connected" && (
						<div className="monitor-button-container">
							<button className="primary-button" onClick={goToMonitor}>
								Go to Monitor
							</button>
						</div>
					)}
				</div>

				{showInstructions && (
					<div className="instructions card">
						<h2>Connection Instructions</h2>
						<ol>
							<li>Scan the QR code with your phone's camera</li>
							<li>Open the link that appears</li>
							<li>Allow camera access when prompted</li>
							<li>Keep the phone page open while monitoring</li>
						</ol>
						<div className="note">
							<p>
								<strong>Note:</strong> Both devices must be connected to the
								internet. For best results, use the same WiFi network.
							</p>
						</div>
					</div>
				)}

				{connectionStatus === "connected" && (
					<div className="next-steps card">
						<h2>Connection Successful!</h2>
						<p>
							Your phone is now connected and ready to monitor your heart rate.
						</p>
						<p>Click the button below to go to the monitoring page.</p>
						<button className="primary-button" onClick={goToMonitor}>
							Start Monitoring
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

export default ConnectPhone;
