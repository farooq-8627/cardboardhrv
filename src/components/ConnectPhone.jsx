import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";

function ConnectPhone({
	isConnected,
	onConnect,
	sessionId,
	connectedSessionId,
	debugConnectionStatus,
}) {
	const [activeTab, setActiveTab] = useState("qrcode");
	const [manualCode, setManualCode] = useState("");
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const [qrValue, setQrValue] = useState("");
	const [localIp, setLocalIp] = useState("");
	const qrValueRef = useRef(null);

	useEffect(() => {
		// Generate the QR code URL only once when the component mounts
		if (!qrValueRef.current && sessionId) {
			// Get the current hostname/IP
			const hostname = window.location.hostname;
			const port = window.location.port;
			const protocol = window.location.protocol;

			// Create the URL for the mobile connection
			const baseUrl = `${protocol}//${hostname}${port ? ":" + port : ""}`;
			const mobileUrl = `${baseUrl}/mobile?session=${sessionId}`;

			console.log("Generated QR code URL with session ID:", sessionId);
			setQrValue(mobileUrl);
			qrValueRef.current = mobileUrl;
			setLocalIp(hostname);

			// Store the QR value in sessionStorage to keep it consistent across tab changes
			try {
				sessionStorage.setItem("cardboardhrv-qr-value", mobileUrl);
			} catch (e) {
				console.error("Failed to store QR value in sessionStorage:", e);
			}
		} else if (!qrValueRef.current) {
			// Try to retrieve from sessionStorage if not set yet
			try {
				const storedQrValue = sessionStorage.getItem("cardboardhrv-qr-value");
				if (storedQrValue) {
					console.log("Retrieved QR code URL from sessionStorage");
					setQrValue(storedQrValue);
					qrValueRef.current = storedQrValue;

					// Extract hostname from the stored URL
					const url = new URL(storedQrValue);
					setLocalIp(url.hostname);
				}
			} catch (e) {
				console.error("Failed to retrieve QR value from sessionStorage:", e);
			}
		}

		// If already connected, redirect to monitor
		if (isConnected) {
			navigate("/monitor");
		}
	}, [isConnected, navigate, sessionId]);

	const handleTabChange = (tab) => {
		setActiveTab(tab);
		setError("");
	};

	const handleManualConnect = (e) => {
		e.preventDefault();
		if (!manualCode.trim()) {
			setError("Please enter a valid connection code");
			return;
		}

		// In a real implementation, this would validate the code
		// For this demo, we'll just simulate a connection
		onConnect(manualCode);
	};

	return (
		<div className="connect-phone">
			<div className="section-title">
				<h2>Connect Your Phone</h2>
			</div>

			{isConnected ? (
				<div className="connection-status connected card">
					<div className="success-icon">✓</div>
					<h3>Phone Connected!</h3>
					<p>
						Your phone is now connected and sending data to the application.
					</p>
					<p>
						Session ID: <strong>{connectedSessionId}</strong>
					</p>
					<p>You can now go to the Live Monitor to see your heart rate data.</p>
					<button
						className="primary-button"
						onClick={() => navigate("/monitor")}
					>
						Go to Live Monitor
					</button>
				</div>
			) : (
				<div className="connection-status card">
					<p>
						To monitor your heart rate, connect your smartphone to this
						application.
					</p>

					<div className="method-tabs">
						<button
							className={activeTab === "qrcode" ? "active" : ""}
							onClick={() => handleTabChange("qrcode")}
						>
							<span className="tab-icon">📱</span> QR Code
						</button>
						<button
							className={activeTab === "manual" ? "active" : ""}
							onClick={() => handleTabChange("manual")}
						>
							<span className="tab-icon">🔢</span> Manual Code
						</button>
						<button
							className={activeTab === "local" ? "active" : ""}
							onClick={() => handleTabChange("local")}
						>
							<span className="tab-icon">🌐</span> Local Network
						</button>
					</div>

					<div className="method-content">
						{activeTab === "qrcode" && (
							<div className="qrcode-method">
								<div className="qrcode-container">
									{qrValue ? (
										<QRCode value={qrValue} size={200} />
									) : (
										<div className="mock-qrcode">
											<div className="qr-placeholder"></div>
											<p>Generating QR code...</p>
										</div>
									)}
									{qrValue && (
										<p className="qr-url">
											<a
												href={qrValue}
												target="_blank"
												rel="noopener noreferrer"
											>
												{qrValue}
											</a>
										</p>
									)}
								</div>

								<div className="instructions">
									<h4>How to Connect:</h4>
									<ol>
										<li>Open your smartphone's camera app</li>
										<li>Scan the QR code above</li>
										<li>Tap the link that appears</li>
										<li>Follow the instructions on your phone</li>
									</ol>
								</div>
							</div>
						)}

						{activeTab === "manual" && (
							<div className="manual-method">
								<form onSubmit={handleManualConnect}>
									<div className="input-group">
										<label htmlFor="connection-code">Connection Code:</label>
										<input
											type="text"
											id="connection-code"
											value={manualCode}
											onChange={(e) => setManualCode(e.target.value)}
											placeholder="Enter the 8-digit code"
										/>
										<button type="submit">Connect</button>
									</div>
									{error && <p className="error-message">{error}</p>}
								</form>

								<div className="instructions">
									<h4>How to Find Your Code:</h4>
									<ol>
										<li>
											Open <strong>{window.location.origin}/mobile</strong> on
											your smartphone
										</li>
										<li>
											Enter the session ID: <strong>{sessionId}</strong>
										</li>
										<li>Follow the instructions on your phone</li>
									</ol>
								</div>
							</div>
						)}

						{activeTab === "local" && (
							<div className="local-connection">
								<p>
									If you're on the same WiFi network, you can connect directly
									using this link:
								</p>
								<p className="qr-url">
									<a href={qrValue} target="_blank" rel="noopener noreferrer">
										{qrValue}
									</a>
								</p>

								<div className="connection-note card">
									<p>
										<span className="warning-icon">⚠️</span> Make sure both
										devices are connected to the same WiFi network.
									</p>
								</div>

								<div className="instructions">
									<h4>Session Information:</h4>
									<ul>
										<li>
											<strong>Session ID:</strong> {sessionId}
										</li>
										<li>
											<strong>Local IP:</strong> {localIp}
										</li>
									</ul>
								</div>
							</div>
						)}
					</div>

					<div
						className="debug-section"
						style={{
							marginTop: "1rem",
							padding: "1rem",
							backgroundColor: "#f0f0f0",
							borderRadius: "4px",
							fontSize: "0.8rem",
						}}
					>
						<h4>Debug Information</h4>
						<p>Session ID: {sessionId}</p>
						<p>Connected: {isConnected ? "Yes" : "No"}</p>
						<p>Connected Session ID: {connectedSessionId || "None"}</p>
						<button
							onClick={debugConnectionStatus}
							style={{
								padding: "0.5rem",
								marginTop: "0.5rem",
								backgroundColor: "#007bff",
								color: "white",
								border: "none",
								borderRadius: "4px",
							}}
						>
							Debug Connection
						</button>
					</div>
				</div>
			)}

			<div className="camera-permission-info card">
				<h3>Camera Requirements</h3>
				<div className="camera-requirements">
					<h4>For best results:</h4>
					<ul>
						<li>Use a smartphone with a good quality camera</li>
						<li>Ensure good lighting conditions</li>
						<li>
							Place your fingertip gently over the camera lens when prompted
						</li>
						<li>
							Keep your finger still during measurement for accurate readings
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}

export default ConnectPhone;
