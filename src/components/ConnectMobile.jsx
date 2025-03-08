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
	const [showCameraTest, setShowCameraTest] = useState(false);
	const [cameraStream, setCameraStream] = useState(null);

	// Function to explicitly request camera permission with a direct user interaction
	const requestCameraPermission = async () => {
		try {
			console.log("Explicitly requesting camera permission...");

			// Try with simpler constraints first
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: false,
			});

			console.log("Camera permission granted!");
			setCameraStream(stream);

			// Show the camera feed to confirm it's working
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				setShowCameraTest(true);

				// After 3 seconds, hide the camera test
				setTimeout(() => {
					setShowCameraTest(false);
					// Don't stop the stream yet, keep it active for the connection
					setCameraPermission("granted");
					setStatus("connected");
				}, 3000);
			}

			return true;
		} catch (err) {
			console.error("Camera permission request failed:", err);
			console.error("Error name:", err.name);
			console.error("Error message:", err.message);

			if (err.name === "NotAllowedError") {
				setCameraPermission("denied");
			} else if (err.name === "NotFoundError") {
				setCameraPermission("notfound");
			} else {
				setCameraPermission("error");
			}
			setStatus("connected-nocamera");
			return false;
		}
	};

	// Clean up camera stream when component unmounts
	useEffect(() => {
		return () => {
			if (cameraStream) {
				cameraStream.getTracks().forEach((track) => track.stop());
			}
		};
	}, [cameraStream]);

	useEffect(() => {
		if (!sessionId) {
			setStatus("error");
			setError("No session ID provided. Please scan the QR code again.");
			return;
		}

		setStatus("connecting");

		// Check if camera is supported
		const checkCameraSupport = async () => {
			// First check if the browser supports getUserMedia
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				console.log("Camera API not supported in this browser");
				setCameraSupported(false);
				return false;
			}

			// We'll check for permission in the connect flow
			return true;
		};

		// In a real implementation, this would connect to your backend
		// and establish a WebSocket or WebRTC connection
		const connectToBackend = async () => {
			try {
				// Simulate connection process
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Check camera support
				const isCameraSupported = await checkCameraSupport();

				if (isCameraSupported) {
					// Set status to request-camera to show the camera permission button
					setStatus("request-camera");
				} else {
					// We'll still allow connection, but with a warning
					setStatus("connected-nocamera");
				}
			} catch (err) {
				console.error("Connection error:", err);
				setStatus("error");
				setError("Failed to connect to the application. Please try again.");
			}
		};

		connectToBackend();
	}, [sessionId, navigate]);

	const handleRetry = () => {
		window.location.reload();
	};

	const handleGoBack = () => {
		// Stop camera stream if active
		if (cameraStream) {
			cameraStream.getTracks().forEach((track) => track.stop());
		}

		// This would typically go back to the main app
		window.close();
		// If window.close() doesn't work (e.g., the page wasn't opened by a script)
		navigate("/");
	};

	const handleRequestCameraPermission = async () => {
		await requestCameraPermission();
	};

	// Function to open Chrome settings directly
	const openChromeSettings = () => {
		// This will open Chrome's camera settings page
		window.open("chrome://settings/content/camera", "_blank");
	};

	return (
		<div className="connect-mobile">
			<h1>CardboardHRV Mobile Connection</h1>

			<div className="connection-status-container">
				{status === "initializing" && (
					<div className="status initializing">
						<div className="spinner"></div>
						<p>Initializing connection...</p>
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

						<div className="camera-permission-info">
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
							className="primary-button camera-button"
							onClick={handleRequestCameraPermission}
						>
							Allow Camera Access
						</button>

						<p className="skip-note">
							<small>
								If you prefer not to grant camera access, you can{" "}
								<button
									className="text-button"
									onClick={() => setStatus("connected-nocamera")}
								>
									skip this step
								</button>
								, but heart rate monitoring will not be available.
							</small>
						</p>
					</div>
				)}

				{showCameraTest && (
					<div className="camera-test-container">
						<p>Camera test in progress...</p>
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							className="camera-test-video"
						/>
						<p>Camera is working! Continuing in a moment...</p>
					</div>
				)}

				{status === "connected" && (
					<div className="status connected">
						<div className="success-icon">✓</div>
						<h2>Successfully Connected!</h2>
						<p>Your phone is now connected to the CardboardHRV application.</p>
						<p>
							Please place your phone in the Cardboard VR headset to begin
							monitoring.
						</p>
						<p className="instruction">
							Make sure the camera is aligned with the optical fiber attachment.
						</p>

						<div className="buttons">
							<button className="primary-button" onClick={handleGoBack}>
								Close This Page
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
							<div className="camera-permission-info">
								<p>
									Heart rate monitoring requires camera access to capture the
									PPG signal.
								</p>
								<p>
									<strong>To enable camera access in Chrome:</strong>
								</p>
								<ol className="browser-instructions">
									<li>Tap the lock/info icon in the address bar</li>
									<li>Select "Site settings"</li>
									<li>Find "Camera" and change it to "Allow"</li>
									<li>Refresh this page</li>
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
										className="primary-button"
										onClick={handleRequestCameraPermission}
									>
										Try Again
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
							<p>
								Your browser doesn't support camera access. Please try using
								Chrome, Safari, or Firefox.
							</p>
						)}

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
		</div>
	);
}

export default ConnectMobile;
