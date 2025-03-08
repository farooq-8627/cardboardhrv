import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

function ConnectMobile() {
	const [searchParams] = useSearchParams();
	const sessionId = searchParams.get("session");
	const navigate = useNavigate();
	const [status, setStatus] = useState("initializing");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!sessionId) {
			setStatus("error");
			setError("No session ID provided. Please scan the QR code again.");
			return;
		}

		setStatus("connecting");

		// In a real implementation, this would connect to your backend
		// and establish a WebSocket or WebRTC connection
		const connectToBackend = async () => {
			try {
				// Simulate connection process
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Check if camera access is available (for PPG signal capture)
				if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
					try {
						const stream = await navigator.mediaDevices.getUserMedia({
							video: true,
						});
						// Stop the stream immediately, we just wanted to check permission
						stream.getTracks().forEach((track) => track.stop());

						setStatus("connected");

						// In a real implementation, you would:
						// 1. Establish a WebSocket connection to the main app
						// 2. Start capturing PPG signals from the camera
						// 3. Process the signals and send heart rate data
					} catch (err) {
						setStatus("error");
						setError(
							"Camera access denied. Please allow camera access to capture heart rate data."
						);
					}
				} else {
					setStatus("error");
					setError(
						"Your device doesn't support camera access, which is required for heart rate monitoring."
					);
				}
			} catch (err) {
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
