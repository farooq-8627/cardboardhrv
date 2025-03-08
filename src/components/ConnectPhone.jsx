import React, { useState, useEffect } from "react";
import QRCode from "qrcode.react";

function ConnectPhone({ isConnected, onConnect }) {
	const [connectionMethod, setConnectionMethod] = useState("qrcode");
	const [qrValue, setQrValue] = useState("");
	const [deviceId, setDeviceId] = useState("");
	const [error, setError] = useState("");
	const [ipAddress, setIpAddress] = useState("");

	// Generate a session ID for QR code
	useEffect(() => {
		const generateSessionId = () => {
			const sessionId = Math.random().toString(36).substring(2, 15);
			const baseUrl = window.location.origin;
			const connectionUrl = `${baseUrl}/connect-mobile?session=${sessionId}`;
			setQrValue(connectionUrl);

			// In a real implementation, you'd register this session with your backend
		};

		generateSessionId();

		// Get local IP for direct connection
		fetch("https://api.ipify.org?format=json")
			.then((response) => response.json())
			.then((data) => {
				setIpAddress(data.ip);
			})
			.catch(() => {
				setIpAddress("Unable to detect");
			});
	}, []);

	const handleConnect = () => {
		if (!deviceId) {
			setError("Please enter a device ID");
			return;
		}

		setError("");
		onConnect(deviceId);
	};

	const handleWebRTCConnect = () => {
		// In a real implementation, this would initiate a WebRTC connection
		alert("WebRTC connection would initiate here in the actual implementation");

		// For demo purposes, we'll just call onConnect
		onConnect("webrtc-device");
	};

	return (
		<div className="connect-phone">
			<h2>Connect Your Phone</h2>

			{isConnected ? (
				<div className="connection-status connected">
					<div className="status-icon">✓</div>
					<h3>Phone Connected!</h3>
					<p>
						Your phone is now connected and sending data to the application.
					</p>
					<p>
						You can now go to the <strong>Live Monitor</strong> to see your
						heart rate data.
					</p>
				</div>
			) : (
				<>
					<div className="connection-methods">
						<div className="method-tabs">
							<button
								className={connectionMethod === "qrcode" ? "active" : ""}
								onClick={() => setConnectionMethod("qrcode")}
							>
								QR Code
							</button>
							<button
								className={connectionMethod === "direct" ? "active" : ""}
								onClick={() => setConnectionMethod("direct")}
							>
								Direct Connection
							</button>
							<button
								className={connectionMethod === "webrtc" ? "active" : ""}
								onClick={() => setConnectionMethod("webrtc")}
							>
								WebRTC
							</button>
						</div>

						<div className="method-content">
							{connectionMethod === "qrcode" && (
								<div className="qrcode-method">
									<p>
										Scan this QR code with your phone's camera to connect it to
										this application:
									</p>
									<div className="qrcode-container">
										<QRCode value={qrValue} size={256} level="H" />
									</div>
									<p>
										<small>
											This will open a web page on your phone that will request
											camera access and establish a connection to this
											application.
										</small>
									</p>
								</div>
							)}

							{connectionMethod === "direct" && (
								<div className="direct-method">
									<p>
										Enter your phone's device ID to establish a direct
										connection:
									</p>
									<div className="input-group">
										<input
											type="text"
											placeholder="Device ID or IP address"
											value={deviceId}
											onChange={(e) => setDeviceId(e.target.value)}
										/>
										<button onClick={handleConnect}>Connect</button>
									</div>
									{error && <p className="error-message">{error}</p>}

									<div className="instructions">
										<h4>How to find your device ID:</h4>
										<ol>
											<li>Install the CardboardHRV mobile app on your phone</li>
											<li>Open the app and go to Settings</li>
											<li>Look for "Device ID" and enter it above</li>
										</ol>

										<div className="local-connection">
											<h4>Direct Connection</h4>
											<p>
												Your local IP address is: <strong>{ipAddress}</strong>
											</p>
											<p>
												Enter this IP address in the CardboardHRV mobile app to
												connect directly.
											</p>
										</div>
									</div>
								</div>
							)}

							{connectionMethod === "webrtc" && (
								<div className="webrtc-method">
									<p>
										Use WebRTC to establish a peer-to-peer connection with your
										phone:
									</p>
									<div className="webrtc-instructions">
										<ol>
											<li>Install the CardboardHRV mobile app on your phone</li>
											<li>
												Open the app and go to the WebRTC Connection screen
											</li>
											<li>
												Click the button below to generate a connection code
											</li>
											<li>Enter the code in your mobile app when prompted</li>
										</ol>
									</div>
									<button
										className="webrtc-button"
										onClick={handleWebRTCConnect}
									>
										Start WebRTC Connection
									</button>

									<p>
										<small>
											WebRTC provides a direct, low-latency connection between
											your phone and this application, which is ideal for
											real-time heart rate monitoring.
										</small>
									</p>
								</div>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

export default ConnectPhone;
