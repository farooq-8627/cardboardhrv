import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

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
	const wsRef = useRef(null);
	const [manualSessionId, setManualSessionId] = useState("");
	const [browserInfo, setBrowserInfo] = useState("");
	const connectionAttempted = useRef(false);
	const [isSecureContext, setIsSecureContext] = useState(true);
	const [isInIframe, setIsInIframe] = useState(false);

	// Store the session ID in localStorage to keep it consistent
	useEffect(() => {
		if (sessionId) {
			try {
				// Store the session ID in localStorage
				localStorage.setItem("cardboardhrv-mobile-session-id", sessionId);
				console.log("Stored session ID in localStorage:", sessionId);
			} catch (e) {
				console.error("Failed to store session ID in localStorage:", e);
			}
		} else {
			// Try to retrieve from localStorage if not in URL
			try {
				const storedSessionId = localStorage.getItem(
					"cardboardhrv-mobile-session-id"
				);
				if (storedSessionId) {
					console.log(
						"Retrieved session ID from localStorage:",
						storedSessionId
					);
					// Navigate to the same page but with the session ID in the URL
					navigate(`/mobile?session=${storedSessionId}`, { replace: true });
				}
			} catch (e) {
				console.error("Failed to retrieve session ID from localStorage:", e);
			}
		}
	}, [sessionId, navigate]);

	// Check for secure context and iframe on mount
	useEffect(() => {
		// Check if we're in a secure context (required for camera access in modern browsers)
		if (typeof window !== "undefined" && !window.isSecureContext) {
			console.error("Not in a secure context - camera access requires HTTPS");
			setIsSecureContext(false);
		}

		// Check if we're in an iframe which might restrict permissions
		try {
			if (window.self !== window.top) {
				console.warn(
					"App is running in an iframe - camera permissions may be restricted"
				);
				setIsInIframe(true);
			}
		} catch (e) {
			// If we can't access window.self or window.top, we're likely in an iframe
			console.warn(
				"Unable to determine if in iframe - assuming restricted context"
			);
			setIsInIframe(true);
		}

		// More thorough check for camera support
		const checkCameraSupport = () => {
			return !!(
				navigator.mediaDevices &&
				navigator.mediaDevices.getUserMedia &&
				window.MediaStream
			);
		};

		setCameraSupported(checkCameraSupport());
		setBrowserInfo(
			`Browser: ${navigator.userAgent}, Secure Context: ${
				window.isSecureContext
			}, Camera API Support: ${checkCameraSupport()}`
		);
	}, []);

	// Function to explicitly request camera permission with a direct user interaction
	const requestCameraPermission = async () => {
		try {
			console.log("Explicitly requesting camera permission...");
			setBrowserInfo(
				`Browser: ${navigator.userAgent}, Secure Context: ${window.isSecureContext}`
			);

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

				// After 3 seconds, start streaming
				setTimeout(() => {
					setShowCameraTest(false);
					setCameraPermission("granted");
					setStatus("connected");
					startStreaming(stream);
				}, 3000);
			}

			// Add this at the end of the try block in requestCameraPermission, right after startStreaming(stream):
			forceConnectionNotification();

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

			// Even if camera access fails, we should still notify the main app that we're connected
			notifyMainAppConnected();

			return false;
		}
	};

	// Function to notify the main app that we're connected
	const notifyMainAppConnected = () => {
		if (connectionAttempted.current) return; // Prevent duplicate notifications

		console.log("Notifying main app of connection");
		window.dispatchEvent(
			new CustomEvent("cardboardhrv-mobile-connect", {
				detail: {
					sessionId: sessionId || manualSessionId,
					timestamp: new Date().toISOString(),
				},
			})
		);

		connectionAttempted.current = true;

		// Also send a direct message
		window.dispatchEvent(
			new CustomEvent("cardboardhrv-mobile-message", {
				detail: {
					data: JSON.stringify({
						type: "connectionStatus",
						sessionId: sessionId || manualSessionId,
						status: "connected",
						message: "Mobile device connected",
						timestamp: new Date().toISOString(),
					}),
				},
			})
		);
	};

	// Function to force connection notification with a direct approach
	const forceConnectionNotification = () => {
		console.log("Forcing connection notification");

		// Try multiple approaches to notify the main app

		// 1. Using localStorage as a fallback communication method
		try {
			localStorage.setItem(
				"cardboardhrv-connection",
				JSON.stringify({
					sessionId: sessionId || manualSessionId,
					timestamp: new Date().toISOString(),
					connected: true,
				})
			);
			console.log("Set connection data in localStorage");
		} catch (e) {
			console.error("Failed to use localStorage:", e);
		}

		// 2. Try to use BroadcastChannel API if available
		try {
			if (typeof BroadcastChannel !== "undefined") {
				const bc = new BroadcastChannel("cardboardhrv-channel");
				bc.postMessage({
					type: "connection",
					sessionId: sessionId || manualSessionId,
					timestamp: new Date().toISOString(),
				});
				console.log("Sent message via BroadcastChannel");
			}
		} catch (e) {
			console.error("Failed to use BroadcastChannel:", e);
		}

		// 3. Still use the custom events as before
		window.dispatchEvent(
			new CustomEvent("cardboardhrv-mobile-connect", {
				detail: {
					sessionId: sessionId || manualSessionId,
					timestamp: new Date().toISOString(),
					forced: true,
				},
			})
		);

		// 4. Try to use window.opener if available (for when opened via QR code)
		try {
			if (window.opener && !window.opener.closed) {
				window.opener.postMessage(
					{
						type: "cardboardhrv-connection",
						sessionId: sessionId || manualSessionId,
						timestamp: new Date().toISOString(),
					},
					"*"
				);
				console.log("Sent message to opener window");
			}
		} catch (e) {
			console.error("Failed to use window.opener:", e);
		}

		// Set a flag in the component to show we've attempted connection
		connectionAttempted.current = true;

		// Update UI to show connection was attempted
		setConnectionInfo(
			"Connection notification sent. Please check your computer screen."
		);
	};

	// Function to directly redirect to the monitor page with connection parameters
	const redirectToMonitor = () => {
		try {
			// Create a URL to the monitor page with connection parameters
			const baseUrl = window.location.origin;
			let finalSessionId = sessionId || manualSessionId;
			// Try to get from localStorage if not available
			if (!finalSessionId) {
				try {
					const storedSessionId = localStorage.getItem(
						"cardboardhrv-mobile-session-id"
					);
					if (storedSessionId) {
						finalSessionId = storedSessionId;
					}
				} catch (e) {
					console.error("Failed to retrieve session ID from localStorage:", e);
				}
			}
			const monitorUrl = `${baseUrl}/monitor?directConnect=true&sessionId=${finalSessionId}&timestamp=${Date.now()}`;

			// Open the monitor URL in a new tab/window
			window.open(monitorUrl, "_blank");

			// Also try to navigate the parent window if possible
			if (window.opener && !window.opener.closed) {
				window.opener.location.href = monitorUrl;
			}

			setConnectionInfo(
				"Redirected to monitor page. Please check your computer browser."
			);
		} catch (e) {
			console.error("Error redirecting to monitor:", e);
			setConnectionInfo(
				"Failed to redirect. Please manually go to the monitor page on your computer."
			);
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

		// Notify the main app that we're connected with camera
		notifyMainAppConnected();

		try {
			// For our simulation, we'll use a custom event system instead of actual WebSockets
			// This is because browsers don't allow WebSocket connections to non-WebSocket servers
			console.log("Setting up connection to main app");

			// Create a simulated WebSocket
			const simulatedWs = {
				readyState: 1, // WebSocket.OPEN
				send: function (data) {
					// Dispatch a custom event that the main app can listen for
					console.log("Sending data to main app:", data);
					window.dispatchEvent(
						new CustomEvent("cardboardhrv-mobile-message", {
							detail: { data },
						})
					);
				},
				close: function () {
					console.log("Closing connection to main app");
					window.dispatchEvent(
						new CustomEvent("cardboardhrv-mobile-close", {
							detail: { sessionId: sessionId || manualSessionId },
						})
					);
					this.readyState = 3; // WebSocket.CLOSED
				},
			};

			wsRef.current = simulatedWs;

			// Send initialization message
			simulatedWs.send(
				JSON.stringify({
					type: "init",
					sessionId: sessionId || manualSessionId,
				})
			);

			setConnectionInfo("Connected to main application");

			// Set up a function to process video frames and extract heart rate
			const processFrame = () => {
				if (!isStreaming || !video || !video.videoWidth) return;

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

				// Send the data to the main application
				if (wsRef.current && wsRef.current.readyState === 1) {
					wsRef.current.send(
						JSON.stringify({
							type: "heartRateData",
							sessionId: sessionId || manualSessionId,
							heartRate: simulatedHeartRate,
							timestamp: new Date().toISOString(),
							rawData: redAvg,
						})
					);
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
				if (wsRef.current && wsRef.current.readyState === 1) {
					wsRef.current.send(
						JSON.stringify({
							type: "ping",
							sessionId: sessionId || manualSessionId,
							timestamp: new Date().toISOString(),
						})
					);
				} else {
					clearInterval(pingInterval);
				}
			}, 5000);

			// Clean up the interval when the component unmounts
			return () => clearInterval(pingInterval);
		} catch (error) {
			console.error("Error setting up connection:", error);
			setConnectionInfo("Failed to connect to main application");
		}
	};

	// Clean up camera stream and WebSocket when component unmounts
	useEffect(() => {
		// Set up event listener for the main app's response
		const handleMainAppResponse = (event) => {
			const data = JSON.parse(event.detail.data);
			console.log("Received response from main app:", data);

			if (data.type === "connectionStatus") {
				setConnectionInfo(data.message);
			}
		};

		window.addEventListener("cardboardhrv-main-message", handleMainAppResponse);

		return () => {
			// Clean up camera stream
			if (cameraStream) {
				cameraStream.getTracks().forEach((track) => track.stop());
			}

			// Clean up WebSocket
			if (wsRef.current) {
				wsRef.current.close();
			}

			// Remove event listener
			window.removeEventListener(
				"cardboardhrv-main-message",
				handleMainAppResponse
			);

			// Clear any ping intervals
			if (window.cardboardHrvPingInterval) {
				clearInterval(window.cardboardHrvPingInterval);
				window.cardboardHrvPingInterval = null;
			}
		};
	}, [cameraStream]);

	useEffect(() => {
		// If no session ID is provided, show the manual entry form
		if (!sessionId) {
			setStatus("no-session");
			return;
		}

		setStatus("connecting");

		// In a real implementation, this would connect to your backend
		// and establish a WebSocket or WebRTC connection
		const connectToBackend = async () => {
			try {
				// Simulate connection process
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Set status to request-camera to show the camera permission button
				setStatus("request-camera");
			} catch (err) {
				console.error("Connection error:", err);
				setStatus("error");
				setError("Failed to connect to the application. Please try again.");
			}
		};

		connectToBackend();
	}, [sessionId, navigate, manualSessionId]);

	const handleRetry = () => {
		window.location.reload();
	};

	const handleGoBack = () => {
		// Stop camera stream if active
		if (cameraStream) {
			cameraStream.getTracks().forEach((track) => track.stop());
		}

		// Close WebSocket if open
		if (wsRef.current) {
			wsRef.current.close();
		}

		// Notify the main app that we're disconnecting
		window.dispatchEvent(
			new CustomEvent("cardboardhrv-mobile-disconnect", {
				detail: {
					sessionId: sessionId || manualSessionId,
					timestamp: new Date().toISOString(),
				},
			})
		);

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
		if (!manualSessionId.trim()) {
			setError("Please enter a valid session ID");
			return;
		}

		// Update the URL with the session ID
		navigate(`/mobile?session=${manualSessionId}`);
	};

	const handleConnectWithoutCamera = () => {
		setStatus("connected-nocamera");
		setCameraPermission("skipped");
		notifyMainAppConnected();

		// Also try the force connection method
		forceConnectionNotification();

		// Add a periodic ping to keep trying to connect
		const pingInterval = setInterval(() => {
			forceConnectionNotification();
		}, 5000); // Try every 5 seconds

		// Store the interval ID for cleanup
		window.cardboardHrvPingInterval = pingInterval;
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
									value={manualSessionId}
									onChange={(e) => setManualSessionId(e.target.value)}
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
						<p className="session-id">
							Session ID: {sessionId || manualSessionId}
						</p>
					</div>
				)}

				{!isSecureContext && (
					<div className="status warning">
						<div className="warning-icon">⚠️</div>
						<h2>Security Warning</h2>
						<p>This app needs to be accessed via HTTPS for camera access.</p>
						<p>
							You can continue without camera functionality, but heart rate
							monitoring will not be available.
						</p>
						<div className="buttons">
							<button
								className="primary-button"
								onClick={handleConnectWithoutCamera}
							>
								Continue without camera
							</button>
							<button className="secondary-button" onClick={handleGoBack}>
								Go Back
							</button>
						</div>
					</div>
				)}

				{isInIframe && (
					<div className="status warning">
						<div className="warning-icon">⚠️</div>
						<h2>Iframe Detected</h2>
						<p>
							This app is running in an iframe, which may restrict camera
							access.
						</p>
						<p>For best results, open this page directly in your browser.</p>
						<div className="buttons">
							<button
								className="primary-button"
								onClick={() => window.open(window.location.href, "_blank")}
							>
								Open in New Window
							</button>
							<button
								className="secondary-button"
								onClick={handleConnectWithoutCamera}
							>
								Continue Anyway
							</button>
						</div>
					</div>
				)}

				{status === "request-camera" && !isInIframe && isSecureContext && (
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

						<div className="buttons">
							<button className="primary-button" onClick={handleGoBack}>
								Disconnect
							</button>
							<button
								onClick={redirectToMonitor}
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
										className="primary-button"
										onClick={handleRequestCameraPermission}
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

						<div
							className="debug-info"
							style={{
								margin: "1rem 0",
								padding: "1rem",
								backgroundColor: "#f0f0f0",
								borderRadius: "4px",
								fontSize: "0.8rem",
							}}
						>
							<h4>Debug Information</h4>
							<p>Session ID: {sessionId || manualSessionId}</p>
							<p>
								Connection Status:{" "}
								{connectionAttempted.current ? "Attempted" : "Not Attempted"}
							</p>
							<p>Browser Info: {browserInfo}</p>
							<button
								onClick={() => {
									forceConnectionNotification();
									alert(
										"Connection notification sent. Please check your computer."
									);
								}}
								style={{
									padding: "0.5rem",
									marginTop: "0.5rem",
									backgroundColor: "#007bff",
									color: "white",
									border: "none",
									borderRadius: "4px",
								}}
							>
								Force Connection Notification
							</button>
							<button
								onClick={redirectToMonitor}
								style={{
									padding: "0.5rem",
									marginTop: "0.5rem",
									backgroundColor: "#28a745",
									color: "white",
									border: "none",
									borderRadius: "4px",
									display: "block",
									width: "100%",
								}}
							>
								Open Monitor Page Directly
							</button>
						</div>

						<div className="buttons">
							<button className="primary-button" onClick={handleGoBack}>
								Go Back
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

			<div
				style={{
					position: "fixed",
					bottom: "20px",
					left: "0",
					right: "0",
					padding: "1rem",
					backgroundColor: "rgba(40, 167, 69, 0.9)",
					textAlign: "center",
					zIndex: "1000",
				}}
			>
				<button
					onClick={redirectToMonitor}
					style={{
						padding: "1rem 2rem",
						backgroundColor: "white",
						color: "#28a745",
						border: "none",
						borderRadius: "4px",
						fontWeight: "bold",
						fontSize: "1.1rem",
						boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
						cursor: "pointer",
					}}
				>
					Open Monitor on Computer
				</button>
			</div>
		</div>
	);
}

export default ConnectMobile;
