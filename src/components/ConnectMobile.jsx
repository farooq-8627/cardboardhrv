import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

function ConnectMobile() {
	const [searchParams] = useSearchParams();
	const sessionId = searchParams.get("session");
	const navigate = useNavigate();
	const [status, setStatus] = useState("initializing");
	const [error, setError] = useState("");
	const [cameraSupported, setCameraSupported] = useState(true);
	const [cameraPermission, setCameraPermission] = useState(null);

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

			// Then check if we can actually access the camera
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: true,
				});
				// Stop the stream immediately, we just wanted to check permission
				stream.getTracks().forEach((track) => track.stop());
				setCameraPermission("granted");
				return true;
			} catch (err) {
				console.error("Camera access error:", err);
				if (err.name === "NotAllowedError") {
					setCameraPermission("denied");
				} else if (err.name === "NotFoundError") {
					setCameraPermission("notfound");
				} else {
					setCameraPermission("error");
				}
				return false;
			}
		};

		// In a real implementation, this would connect to your backend
		// and establish a WebSocket or WebRTC connection
		const connectToBackend = async () => {
			try {
				// Simulate connection process
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Check camera support and access
				const hasCameraAccess = await checkCameraSupport();

				if (hasCameraAccess) {
					setStatus("connected");

					// In a real implementation, you would:
					// 1. Establish a WebSocket connection to the main app
					// 2. Start capturing PPG signals from the camera
					// 3. Process the signals and send heart rate data
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
		// This would typically go back to the main app
		window.close();
		// If window.close() doesn't work (e.g., the page wasn't opened by a script)
		navigate("/");
	};

	const handleRequestCameraPermission = async () => {
		try {
			await navigator.mediaDevices.getUserMedia({ video: true });
			window.location.reload();
		} catch (err) {
			console.error("Failed to get camera permission:", err);
			setError(
				"Camera permission was denied. Please enable camera access in your browser settings and try again."
			);
		}
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
								<p>Please enable camera access in your browser settings.</p>
								<button
									className="primary-button"
									onClick={handleRequestCameraPermission}
								>
									Request Camera Permission
								</button>
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
