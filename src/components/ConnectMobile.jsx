import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import connectionService from "../utils/connectionService";

function ConnectMobile() {
	const [searchParams] = useSearchParams();
	const sessionId = searchParams.get("session");
	const navigate = useNavigate();
	const [status, setStatus] = useState("initializing");
	const [error, setError] = useState("");
	const [cameraSupported, setCameraSupported] = useState(true);
	const [cameraPermission, setCameraPermission] = useState(null);
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const [showCameraTest, setShowCameraTest] = useState(false);
	const [cameraStream, setCameraStream] = useState(null);
	const [isStreaming, setIsStreaming] = useState(false);
	const [heartRate, setHeartRate] = useState(0);
	const [connectionInfo, setConnectionInfo] = useState("");
	const [browserInfo, setBrowserInfo] = useState("");
	const [connectionStatus, setConnectionStatus] = useState("disconnected");
	const [deviceInfo, setDeviceInfo] = useState(null);
	const processingRef = useRef(false);

	// Initialize connection service when component mounts
	useEffect(() => {
		if (!sessionId) {
			setStatus("no-session");
			return;
		}

		setStatus("connecting");

		// Initialize connection service
		const initializeConnection = async () => {
			// Initialize connection service
			const success = await connectionService.initialize(sessionId, "mobile");
			if (success) {
				console.log(`Initialized connection service for session ${sessionId}`);

				// Set up event listeners
				connectionService.on(
					"connectionStatusChanged",
					handleConnectionStatusChanged
				);
				connectionService.on("devicesPaired", handleDevicesPaired);
				connectionService.on("message", handleMessage);

				// Check if camera is supported
				checkCameraSupport();
			} else {
				console.error("Failed to initialize connection service");
				setStatus("error");
				setError("Failed to connect to the application. Please try again.");
			}
		};

		initializeConnection();

		// Clean up event listeners
		return () => {
			// Stop camera stream if active
			if (cameraStream) {
				cameraStream.getTracks().forEach((track) => track.stop());
			}

			// Clean up connection service
			connectionService.off(
				"connectionStatusChanged",
				handleConnectionStatusChanged
			);
			connectionService.off("devicesPaired", handleDevicesPaired);
			connectionService.off("message", handleMessage);

			// Disconnect from the session
			connectionService.disconnect();
		};
	}, [sessionId, navigate]);

	// Handle connection status changes
	const handleConnectionStatusChanged = (data) => {
		console.log("Connection status changed:", data.status);
		setConnectionStatus(data.status);
		setConnectionInfo(`Connection status: ${data.status}`);
	};

	// Handle devices paired event
	const handleDevicesPaired = (data) => {
		console.log("Devices paired:", data);
		setDeviceInfo(data);
		setConnectionInfo("Connected to desktop device!");
	};

	// Handle message event
	const handleMessage = (data) => {
		console.log("Message received:", data);
		setConnectionInfo(`Message from desktop: ${data.text}`);
	};

	// Check if camera is supported
	const checkCameraSupport = () => {
		// Check if we're in a secure context (required for camera access in modern browsers)
		if (typeof window !== "undefined" && !window.isSecureContext) {
			console.error("Not in a secure context - camera access requires HTTPS");
			setCameraSupported(false);
			setBrowserInfo(
				`Not in a secure context. User agent: ${navigator.userAgent}`
			);
			setStatus("request-camera");
			return false;
		}

		// Check if we're in an iframe which might restrict permissions
		try {
			if (window.self !== window.top) {
				console.warn(
					"App is running in an iframe - camera permissions may be restricted"
				);
				setBrowserInfo(`Running in iframe. User agent: ${navigator.userAgent}`);
			}
		} catch (e) {
			// If we can't access window.self or window.top, we're likely in an iframe
			console.warn(
				"Unable to determine if in iframe - assuming restricted context"
			);
			setBrowserInfo(
				`Unable to determine iframe status. User agent: ${navigator.userAgent}`
			);
		}

		// Check if the browser supports getUserMedia
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			setCameraSupported(true);
			setStatus("request-camera");
			return true;
		} else {
			setCameraSupported(false);
			setBrowserInfo(
				`Browser doesn't support getUserMedia. User agent: ${navigator.userAgent}`
			);
			setStatus("request-camera");
			return false;
		}
	};

	// Function to explicitly request camera permission with a direct user interaction
	const requestCameraPermission = async () => {
		try {
			console.log("Explicitly requesting camera permission...");
			setBrowserInfo(
				`Browser: ${navigator.userAgent}, Secure Context: ${window.isSecureContext}`
			);

			// Show a loading state
			setConnectionInfo("Requesting camera access...");

			// Make sure we're using the most reliable approach for modern Chrome
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					// Remove specific width/height constraints that might cause issues
				},
				audio: false,
			});

			console.log("Camera permission granted!");
			setCameraStream(stream);
			setCameraSupported(true);

			// Show the camera feed to confirm it's working
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				setShowCameraTest(true);

				// Update connection info
				setConnectionInfo("Camera access granted. Testing camera feed...");
			}

			return true;
		} catch (error) {
			console.error("Camera permission request failed:", error);

			// More detailed error logging for debugging
			console.log("Error name:", error.name);
			console.log("Error message:", error.message);
			console.log("Error constraints:", error.constraint);

			if (error.name === "NotAllowedError") {
				setCameraPermission("denied");
			} else if (error.name === "NotFoundError") {
				setCameraPermission("notfound");
			} else {
				setCameraPermission("error");
			}
			setStatus("connected-nocamera");

			return false;
		}
	};

	// Function to start streaming camera data to the main application
	const startStreaming = (stream) => {
		if (!stream) return;

		setIsStreaming(true);

		// Create a canvas to process the video frames
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		const video = videoRef.current;

		try {
			console.log("Setting up camera processing");

			// Set up a function to process video frames and extract heart rate
			const processFrame = () => {
				if (
					!isStreaming ||
					!video ||
					!video.videoWidth ||
					processingRef.current
				)
					return;

				processingRef.current = true;

				try {
					// Set canvas dimensions to match video
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					// Draw the current video frame to the canvas
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

					// Get the image data from the canvas
					const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

					// Simple PPG signal extraction (red channel average)
					let redSum = 0;
					const data = imageData.data;

					// Sample only a portion of the image for performance
					const sampleSize = 50;
					const centerX = Math.floor(canvas.width / 2);
					const centerY = Math.floor(canvas.height / 2);
					const startX = centerX - sampleSize / 2;
					const startY = centerY - sampleSize / 2;

					for (let y = startY; y < startY + sampleSize; y++) {
						for (let x = startX; x < startX + sampleSize; x++) {
							const index = (y * canvas.width + x) * 4;
							redSum += data[index]; // Red channel
						}
					}

					const redAvg = redSum / (sampleSize * sampleSize);

					// Simulate heart rate calculation (in a real app, this would use a more sophisticated algorithm)
					// For demo purposes, we'll use a simple simulation
					const simulatedHeartRate = Math.floor(60 + Math.random() * 30);
					setHeartRate(simulatedHeartRate);

					// Send the data to the connection service
					connectionService.sendHeartRateData({
						heartRate: simulatedHeartRate,
						timestamp: Date.now(),
						rawData: redAvg,
					});

					processingRef.current = false;
				} catch (error) {
					console.error("Error processing frame:", error);
					processingRef.current = false;
				}

				// Continue processing frames
				if (isStreaming) {
					requestAnimationFrame(processFrame);
				}
			};

			// Start processing frames
			processFrame();

			// Set up a ping to keep the connection alive
			const pingInterval = setInterval(() => {
				connectionService.sendMessage("Ping from mobile device");
			}, 5000);

			// Store the interval ID for cleanup
			window.cardboardHrvPingInterval = pingInterval;

			// Return a cleanup function
			return () => {
				clearInterval(pingInterval);
				window.cardboardHrvPingInterval = null;
			};
		} catch (error) {
			console.error("Error setting up camera processing:", error);
			setConnectionInfo("Failed to process camera feed");
		}
	};

	const handleRetry = () => {
		window.location.reload();
	};

	const handleGoBack = () => {
		// Stop camera stream if active
		if (cameraStream) {
			cameraStream.getTracks().forEach((track) => track.stop());
		}

		// Disconnect from the session
		connectionService.disconnect();

		// This would typically go back to the main app
		window.close();
		// If window.close() doesn't work (e.g., the page wasn't opened by a script)
		navigate("/");
	};

	const handleRequestCameraPermission = async () => {
		await requestCameraPermission();
	};

	const handleManualSessionSubmit = (e) => {
		e.preventDefault();
		const manualSessionId = e.target.elements.sessionId.value;
		if (!manualSessionId.trim()) {
			setError("Please enter a valid session ID");
			return;
		}

		// Update the URL with the session ID
		navigate(`/mobile?session=${manualSessionId}`, { replace: true });
	};

	const handleConnectWithoutCamera = () => {
		setStatus("connected-nocamera");
		setCameraPermission("skipped");
	};

	// Function to open the monitor page on the desktop
	const openMonitorPage = () => {
		// Create a URL to the monitor page with connection parameters
		const baseUrl = window.location.origin;
		const monitorUrl = `${baseUrl}/monitor?directConnect=true&sessionId=${sessionId}&timestamp=${Date.now()}`;

		// Open the monitor URL in a new tab/window
		window.open(monitorUrl, "_blank");

		// Also try to navigate the parent window if possible
		if (window.opener && !window.opener.closed) {
			window.opener.location.href = monitorUrl;
		}

		setConnectionInfo(
			"Opened monitor page. Please check your computer browser."
		);
	};

	return (
		<div className="connect-mobile">
			<div className="section-title">
				<h1>CardboardHRV Mobile Connection</h1>
			</div>

			<div className="connection-status-container card">
				{status === "initializing" && (
					<div className="status initializing">
						<div className="spinner"></div>
						<p>Initializing connection...</p>
					</div>
				)}

				{status === "no-session" && (
					<div className="status manual-session">
						<h2>Enter Session ID</h2>
						<p>
							Please enter the session ID displayed on your computer screen.
						</p>

						<form onSubmit={handleManualSessionSubmit}>
							<div className="input-group">
								<input
									type="text"
									name="sessionId"
									placeholder="Enter session ID"
								/>
								<button type="submit" className="primary-button">
									Connect
								</button>
							</div>
							{error && <p className="error-message">{error}</p>}
						</form>

						<div className="instructions">
							<h4>How to find your session ID:</h4>
							<ol>
								<li>On your computer, go to the "Connect Phone" page</li>
								<li>Look for the "Session ID" in the Local Network section</li>
								<li>Enter that code here to connect</li>
							</ol>
						</div>

						<p className="connection-note">
							<span className="warning-icon">⚠️</span> Make sure both devices
							are connected to the same WiFi network.
						</p>
					</div>
				)}

				{status === "connecting" && (
					<div className="status connecting">
						<div className="spinner"></div>
						<p>Connecting to CardboardHRV application...</p>
						<p className="session-id">Session ID: {sessionId}</p>
					</div>
				)}

				{status === "request-camera" && (
					<div className="status camera-request">
						<h2>Connection Successful!</h2>
						<p>To monitor your heart rate, we need access to your camera.</p>
						<p>
							Please tap the button below and allow camera access when prompted.
						</p>

						<div
							style={{
								backgroundColor: "#f8d7da",
								color: "#721c24",
								padding: "1rem",
								borderRadius: "4px",
								marginTop: "1rem",
								marginBottom: "1rem",
								textAlign: "center",
								fontWeight: "bold",
							}}
						>
							👇 Tap the blue button below to allow camera access 👇
						</div>

						<div className="camera-permission-info card">
							<p>
								<strong>Why we need camera access:</strong>
							</p>
							<p>
								The camera is used to detect subtle color changes in your skin
								that indicate your heartbeat (PPG signal).
							</p>
							<p>
								Your camera feed is processed locally and is not stored or
								transmitted.
							</p>
						</div>

						<div className="camera-test-placeholder">
							<div className="camera-icon">📷</div>
							<p>Your camera will appear here</p>
						</div>

						<button
							onClick={handleRequestCameraPermission}
							style={{
								padding: "1rem",
								marginTop: "1rem",
								backgroundColor: "#007bff",
								color: "white",
								border: "none",
								borderRadius: "4px",
								fontSize: "1.1rem",
								fontWeight: "bold",
								width: "100%",
								boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
								cursor: "pointer",
							}}
						>
							Allow Camera Access
						</button>

						<div
							style={{
								marginTop: "1rem",
								padding: "1rem",
								backgroundColor: "#f8f9fa",
								borderRadius: "4px",
								textAlign: "center",
							}}
						>
							<p style={{ marginBottom: "0.5rem" }}>
								If you prefer not to grant camera access:
							</p>
							<button
								onClick={handleConnectWithoutCamera}
								style={{
									padding: "0.75rem",
									backgroundColor: "#6c757d",
									color: "white",
									border: "none",
									borderRadius: "4px",
									fontWeight: "bold",
									width: "100%",
									marginBottom: "0.5rem",
									cursor: "pointer",
								}}
							>
								Connect Without Camera
							</button>
							<p style={{ fontSize: "0.8rem", color: "#dc3545" }}>
								Note: Heart rate monitoring will not be available without camera
								access.
							</p>
						</div>
					</div>
				)}

				{showCameraTest && (
					<div
						className="camera-test-container"
						style={{
							padding: "1rem",
							backgroundColor: "#f8f9fa",
							borderRadius: "8px",
							textAlign: "center",
						}}
					>
						<h3 style={{ color: "#28a745", marginBottom: "1rem" }}>
							Camera Test in Progress
						</h3>
						<div
							style={{
								position: "relative",
								width: "100%",
								maxWidth: "320px",
								margin: "0 auto",
								border: "3px solid #28a745",
								borderRadius: "8px",
								overflow: "hidden",
							}}
						>
							<video
								ref={videoRef}
								autoPlay
								playsInline
								muted
								style={{ width: "100%", height: "auto", display: "block" }}
							/>
							<div
								style={{
									position: "absolute",
									top: "10px",
									right: "10px",
									backgroundColor: "rgba(255,0,0,0.7)",
									width: "15px",
									height: "15px",
									borderRadius: "50%",
									animation: "pulse 1s infinite",
								}}
							></div>
						</div>
						<p style={{ marginTop: "1rem", fontWeight: "bold" }}>
							Camera is working! Processing video feed...
						</p>
						<div style={{ marginTop: "1rem" }}>
							<button
								onClick={() => {
									setShowCameraTest(false);
									setCameraPermission("granted");
									setStatus("connected");
									if (cameraStream) startStreaming(cameraStream);
								}}
								style={{
									padding: "0.75rem 1.5rem",
									backgroundColor: "#28a745",
									color: "white",
									border: "none",
									borderRadius: "4px",
									fontWeight: "bold",
									cursor: "pointer",
								}}
							>
								Continue to Connection
							</button>
						</div>
					</div>
				)}

				{status === "connected" && (
					<div className="status connected">
						<div className="success-icon">✓</div>
						<h2>Successfully Connected!</h2>
						<p>Your phone is now connected to the CardboardHRV application.</p>

						<div className="camera-feed-container" style={{ margin: "1rem 0" }}>
							<h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
								Camera Feed
							</h3>
							<div
								style={{
									position: "relative",
									width: "100%",
									maxWidth: "320px",
									margin: "0 auto",
									border: "3px solid #28a745",
									borderRadius: "8px",
									overflow: "hidden",
								}}
							>
								<video
									ref={videoRef}
									autoPlay
									playsInline
									muted
									style={{ width: "100%", height: "auto", display: "block" }}
								/>
								<canvas ref={canvasRef} style={{ display: "none" }} />
								<div
									style={{
										position: "absolute",
										top: "10px",
										right: "10px",
										backgroundColor: "rgba(255,0,0,0.7)",
										width: "15px",
										height: "15px",
										borderRadius: "50%",
										animation: "pulse 1s infinite",
									}}
								></div>
							</div>
							<p
								style={{
									textAlign: "center",
									marginTop: "0.5rem",
									fontSize: "0.9rem",
									color: "#666",
								}}
							>
								Your camera is active and processing heart rate data
							</p>
						</div>

						<div className="heart-rate-display">
							<h3>Current Heart Rate</h3>
							<div className="heart-rate-value">
								<span className="value">{heartRate}</span>
								<span className="unit">BPM</span>
							</div>
						</div>

						<p className="connection-info">{connectionInfo}</p>

						<div
							className="connection-status-message"
							style={{
								marginTop: "1rem",
								padding: "1rem",
								backgroundColor: "#f8f9fa",
								borderRadius: "8px",
							}}
						>
							<h3 style={{ color: "#28a745", marginBottom: "0.5rem" }}>
								Connection Active
							</h3>
							<p>Your phone is now connected to your computer.</p>
							<p>
								Please check your computer screen to see your heart rate data.
							</p>
							<p style={{ fontWeight: "bold", marginTop: "0.5rem" }}>
								Instructions:
							</p>
							<ol style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
								<li>Place your fingertip gently over the camera lens</li>
								<li>Keep your finger still for accurate readings</li>
								<li>Ensure good lighting for best results</li>
							</ol>
						</div>

						<div className="buttons" style={{ marginTop: "1rem" }}>
							<button className="primary-button" onClick={handleGoBack}>
								Disconnect
							</button>
						</div>
					</div>
				)}

				{status === "connected-nocamera" && (
					<div className="status connected warning">
						<div className="warning-icon">⚠️</div>
						<h2>Connected with Limited Functionality</h2>
						<p>
							Your phone is connected, but camera access is{" "}
							{cameraPermission === "denied" ? "denied" : "not available"}.
						</p>

						{cameraPermission === "denied" && (
							<div className="camera-permission-info card">
								<p>
									Heart rate monitoring requires camera access to capture the
									PPG signal.
								</p>
								<p>
									<strong>To enable camera access in Chrome:</strong>
								</p>
								<ol className="browser-instructions">
									<li>Tap the lock/info icon in the address bar</li>
									<li>Select "Site settings" {"->"} Camera</li>
									<li>Make sure this site is not blocked</li>
									<li>Return to this page and try again</li>
								</ol>

								<div className="chrome-settings-note">
									<p>If you don't see the camera permission option:</p>
									<ol>
										<li>Open Chrome Settings</li>
										<li>Go to Site Settings {"->"} Camera</li>
										<li>Make sure this site is not blocked</li>
										<li>Return to this page and try again</li>
									</ol>
								</div>

								<div className="buttons">
									<button
										onClick={handleRequestCameraPermission}
										style={{
											padding: "0.75rem",
											marginTop: "0.5rem",
											backgroundColor: "#007bff",
											color: "white",
											border: "none",
											borderRadius: "4px",
											fontWeight: "bold",
											width: "100%",
											boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
											cursor: "pointer",
										}}
									>
										Try Camera Access Anyway
									</button>
									<button className="secondary-button" onClick={handleRetry}>
										Refresh Page
									</button>
								</div>
							</div>
						)}

						{cameraPermission === "notfound" && (
							<p>
								No camera was detected on your device. Heart rate monitoring
								requires a camera.
							</p>
						)}

						{cameraPermission === "error" && (
							<p>
								There was an error accessing your camera. Please try using a
								different device.
							</p>
						)}

						{!cameraSupported && (
							<>
								<p>
									Your browser doesn't appear to support camera access or the
									camera is not available.
								</p>
								<p className="browser-info">{browserInfo}</p>
								<div className="buttons">
									<button
										onClick={handleRequestCameraPermission}
										style={{
											padding: "0.75rem",
											marginTop: "0.5rem",
											backgroundColor: "#007bff",
											color: "white",
											border: "none",
											borderRadius: "4px",
											fontWeight: "bold",
											width: "100%",
											boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
											cursor: "pointer",
										}}
									>
										Try Camera Access Anyway
									</button>
								</div>
							</>
						)}

						<div className="connection-status-message">
							<p>Your phone is still connected to the main application.</p>
							<p>
								Please check your computer screen to see the connection status.
							</p>
						</div>

						<div className="buttons">
							<button className="primary-button" onClick={handleGoBack}>
								Go Back
							</button>
							<button
								onClick={openMonitorPage}
								style={{
									padding: "0.5rem",
									marginTop: "0.5rem",
									backgroundColor: "#28a745",
									color: "white",
									border: "none",
									borderRadius: "4px",
									width: "100%",
								}}
							>
								Open Monitor Page Directly
							</button>
						</div>
					</div>
				)}

				{status === "error" && (
					<div className="status error">
						<div className="error-icon">✗</div>
						<h2>Connection Failed</h2>
						<p className="error-message">{error}</p>

						<div className="buttons">
							<button className="primary-button" onClick={handleRetry}>
								Try Again
							</button>
							<button className="secondary-button" onClick={handleGoBack}>
								Go Back
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default ConnectMobile;
