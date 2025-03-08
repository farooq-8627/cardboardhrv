import React, { useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import connectionService from "../utils/connectionService";

function ConnectMobile() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const processingRef = useRef(false);
	const streamRef = useRef(null);
	const frameProcessingRef = useRef(null);
	const [hasCameraAccess, setHasCameraAccess] = useState(false);
	const [isRecording, setIsRecording] = useState(false);

	const {
		sessionId,
		connectionStatus,
		deviceInfo,
		initializeConnection,
		cleanup,
		handleCameraFrame,
	} = useAppContext();

	// Initialize connection service when component mounts
	useEffect(() => {
		const urlSessionId =
			searchParams.get("session") ||
			localStorage.getItem("cardboardhrv-session-id");
		if (!urlSessionId) {
			navigate("/");
			return;
		}

		const setupConnection = async () => {
			const success = await initializeConnection(urlSessionId, "mobile");
			if (!success) {
				console.error("Failed to initialize connection service");
				navigate("/");
				return;
			}

			// If we were previously recording, try to restore camera access
			const wasRecording =
				localStorage.getItem("cardboardhrv-was-recording") === "true";
			if (wasRecording) {
				requestCameraPermission();
			}
		};

		setupConnection();

		return () => {
			cleanup();
			stopCamera();
		};
	}, [searchParams, navigate, initializeConnection, cleanup]);

	// Process frame function
	const processFrame = useCallback(() => {
		if (
			!videoRef.current ||
			!videoRef.current.videoWidth ||
			processingRef.current
		)
			return;

		const video = videoRef.current;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });

		processingRef.current = true;

		try {
			// Set canvas dimensions to match video
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;

			// Draw the current video frame
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

			// Get image data for heart rate processing
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = imageData.data;

			// Process red channel for PPG signal
			let redSum = 0;
			for (let i = 0; i < data.length; i += 4) {
				redSum += data[i];
			}
			const redAvg = redSum / (data.length / 4);

			// Send heart rate data
			const simulatedHeartRate = Math.floor(60 + Math.random() * 30);
			connectionService.sendHeartRateData({
				heartRate: simulatedHeartRate,
				timestamp: Date.now(),
				rawData: redAvg,
			});

			// Create frame data
			const smallCanvas = document.createElement("canvas");
			const smallCtx = smallCanvas.getContext("2d");
			smallCanvas.width = 320;
			smallCanvas.height = 240;
			smallCtx.drawImage(video, 0, 0, smallCanvas.width, smallCanvas.height);
			const frameDataUrl = smallCanvas.toDataURL("image/jpeg", 0.7);
			const timestamp = Date.now();

			// Send frame through both channels
			console.log(
				"Sending camera frame at:",
				new Date(timestamp).toLocaleTimeString()
			);

			const frameData = {
				imageData: frameDataUrl,
				timestamp: timestamp,
				deviceId: connectionService.deviceId,
				type: "cameraFrame",
				sessionId: sessionId,
			};

			// Send via context first
			handleCameraFrame(frameData);

			// Then send via Firebase
			connectionService
				.sendCameraFrame(frameData)
				.then(() => {
					console.log("Frame sent successfully");
					setIsRecording(true); // Update recording status after successful frame send
				})
				.catch((error) => {
					console.error("Error sending frame:", error);
					setIsRecording(false); // Update recording status on error
				});

			processingRef.current = false;

			// Continue processing frames if we have a stream
			if (streamRef.current) {
				frameProcessingRef.current = requestAnimationFrame(processFrame);
			} else {
				setIsRecording(false); // Update recording status if stream is gone
			}
		} catch (error) {
			console.error("Error processing frame:", error);
			processingRef.current = false;
			setIsRecording(false); // Update recording status on error
		}
	}, [handleCameraFrame, sessionId]);

	// Function to start streaming camera data
	const startStreaming = useCallback(
		(stream) => {
			if (!stream || !videoRef.current || !canvasRef.current) return;

			console.log("Starting camera stream...");
			const video = videoRef.current;
			video.srcObject = stream;
			streamRef.current = stream;

			video.onloadedmetadata = () => {
				console.log("Video metadata loaded, starting playback...");
				video.play().catch((error) => {
					console.error("Error playing video:", error);
				});
				processFrame();
				setIsRecording(true);
			};

			video.onplay = () => {
				console.log("Video playback started");
				setIsRecording(true);
			};

			// Add error handling for video
			video.onerror = (error) => {
				console.error("Video error:", error);
				setIsRecording(false);
			};
		},
		[processFrame]
	);

	// Function to explicitly request camera permission
	const requestCameraPermission = useCallback(async () => {
		if (streamRef.current) return true; // Already have camera access

		try {
			console.log("Requesting camera permission...");
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user" },
				audio: false,
			});

			startStreaming(stream);
			localStorage.setItem("cardboardhrv-was-recording", "true");
			setHasCameraAccess(true);
			setIsRecording(true);
			return true;
		} catch (error) {
			console.error("Camera permission request failed:", error);
			localStorage.setItem("cardboardhrv-was-recording", "false");
			setHasCameraAccess(false);
			setIsRecording(false);
			return false;
		}
	}, [startStreaming]);

	// Stop camera function
	const stopCamera = useCallback(() => {
		if (frameProcessingRef.current) {
			cancelAnimationFrame(frameProcessingRef.current);
			frameProcessingRef.current = null;
		}

		if (streamRef.current) {
			const tracks = streamRef.current.getTracks();
			tracks.forEach((track) => track.stop());
			streamRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
		localStorage.setItem("cardboardhrv-was-recording", "false");
		processingRef.current = false;
		setHasCameraAccess(false);
		setIsRecording(false);
	}, []);

	const handleGoBack = useCallback(() => {
		stopCamera();
		cleanup();
		navigate("/");
	}, [stopCamera, cleanup, navigate]);

	// Handle visibility change
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				stopCamera();
			} else if (
				localStorage.getItem("cardboardhrv-was-recording") === "true"
			) {
				requestCameraPermission();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [stopCamera, requestCameraPermission]);

	return (
		<div className="connect-mobile">
			<div className="section-title">
				<h1>CardboardHRV Mobile Connection</h1>
			</div>

			<div className="connection-status-container card">
				{!sessionId ? (
					<div className="error-message">
						<h2>Error</h2>
						<p>No session ID provided. Please go back and try again.</p>
						<button className="primary-button" onClick={handleGoBack}>
							Go Back
						</button>
					</div>
				) : (
					<>
						<div className="status-indicator">
							<h2>Connection Status</h2>
							<div className={`status-dot ${connectionStatus}`} />
							<span>{connectionStatus}</span>
						</div>

						<div className="camera-container">
							{!hasCameraAccess ? (
								<div className="camera-request">
									<p>
										To monitor your heart rate, we need access to your camera.
									</p>
									<button
										className="primary-button"
										onClick={requestCameraPermission}
									>
										Allow Camera Access
									</button>
								</div>
							) : (
								<>
									<h3>
										Camera Feed{" "}
										{isRecording ? "(Recording)" : "(Not Recording)"}
									</h3>
									<div className="video-container">
										<video
											ref={videoRef}
											autoPlay
											playsInline
											muted
											style={{ width: "100%", height: "auto" }}
										/>
										<canvas ref={canvasRef} style={{ display: "none" }} />
									</div>
									<button className="primary-button" onClick={stopCamera}>
										Stop Camera
									</button>
								</>
							)}
						</div>

						{deviceInfo && (
							<div className="connection-info">
								<p>Connected to desktop device</p>
								<p>Session ID: {sessionId}</p>
							</div>
						)}

						<button className="primary-button" onClick={handleGoBack}>
							Disconnect
						</button>
					</>
				)}
			</div>
		</div>
	);
}

export default ConnectMobile;
