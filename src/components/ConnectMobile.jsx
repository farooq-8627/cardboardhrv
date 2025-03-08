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
		syncRecordingStatus,
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
		) {
			console.log(
				"Skipping frame processing - video not ready or already processing"
			);
			return;
		}

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

			// Get image data for PPG signal processing
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = imageData.data;

			// Calculate average red channel value (PPG signal)
			let redSum = 0;
			let pixelCount = 0;
			for (let i = 0; i < data.length; i += 4) {
				// Only process pixels that are skin-colored (reddish)
				if (data[i] > data[i + 1] && data[i] > data[i + 2]) {
					redSum += data[i];
					pixelCount++;
				}
			}
			const redAvg = pixelCount > 0 ? redSum / pixelCount : 0;

			// Store PPG values for heart rate calculation
			const ppgValues = window.ppgValues || [];
			ppgValues.push({ value: redAvg, timestamp: Date.now() });

			// Keep last 5 seconds of data (assuming 30fps)
			const fiveSecondsAgo = Date.now() - 5000;
			while (ppgValues.length > 0 && ppgValues[0].timestamp < fiveSecondsAgo) {
				ppgValues.shift();
			}
			window.ppgValues = ppgValues;

			// Calculate heart rate from PPG signal using improved peak detection
			let heartRate = 60;
			if (ppgValues.length > 30) {
				const peaks = detectPeaks(ppgValues);
				const duration =
					(ppgValues[ppgValues.length - 1].timestamp - ppgValues[0].timestamp) /
					1000;
				heartRate = Math.round((peaks * 60) / duration);
				heartRate = Math.max(40, Math.min(200, heartRate)); // Validate heart rate range
			}

			// Create optimized frame data for transmission
			const frameData = createFrameData(video, heartRate, redAvg, sessionId);

			// Send frame data through both channels with proper error handling
			Promise.all([
				handleCameraFrame(frameData),
				connectionService.sendCameraFrame(frameData),
			])
				.then(() => {
					console.log(
						"Frame sent successfully:",
						new Date().toLocaleTimeString()
					);
					syncRecordingStatus(true);
					processingRef.current = false;

					// Schedule next frame only if we're still streaming
					if (streamRef.current) {
						frameProcessingRef.current = requestAnimationFrame(processFrame);
					} else {
						console.log("Stream ended, stopping frame processing");
						syncRecordingStatus(false);
					}
				})
				.catch((error) => {
					console.error("Error sending frame:", error);
					syncRecordingStatus(false);
					processingRef.current = false;

					// Attempt to recover by scheduling next frame
					if (streamRef.current) {
						frameProcessingRef.current = requestAnimationFrame(processFrame);
					}
				});
		} catch (error) {
			console.error("Error processing frame:", error);
			processingRef.current = false;
			syncRecordingStatus(false);

			// Attempt to recover
			if (streamRef.current) {
				frameProcessingRef.current = requestAnimationFrame(processFrame);
			}
		}
	}, [handleCameraFrame, sessionId, syncRecordingStatus]);

	// Helper function to detect peaks in PPG signal
	const detectPeaks = (ppgValues) => {
		let peaks = 0;
		let isPeak = false;
		const threshold = calculateDynamicThreshold(ppgValues);

		for (let i = 1; i < ppgValues.length - 1; i++) {
			const prev = ppgValues[i - 1].value;
			const curr = ppgValues[i].value;
			const next = ppgValues[i + 1].value;

			if (curr > prev && curr > next && curr > threshold) {
				if (!isPeak) {
					peaks++;
					isPeak = true;
				}
			} else {
				isPeak = false;
			}
		}
		return peaks;
	};

	// Helper function to calculate dynamic threshold for peak detection
	const calculateDynamicThreshold = (ppgValues) => {
		const values = ppgValues.map((p) => p.value);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const stdDev = Math.sqrt(
			values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
		);
		return mean + stdDev;
	};

	// Helper function to create optimized frame data
	const createFrameData = (video, heartRate, ppgValue, sessionId) => {
		const smallCanvas = document.createElement("canvas");
		const smallCtx = smallCanvas.getContext("2d");
		smallCanvas.width = 320;
		smallCanvas.height = 240;
		smallCtx.drawImage(video, 0, 0, smallCanvas.width, smallCanvas.height);

		return {
			imageData: smallCanvas.toDataURL("image/jpeg", 0.7),
			timestamp: Date.now(),
			deviceId: connectionService.deviceId,
			type: "cameraFrame",
			sessionId: sessionId,
			heartRate,
			ppgValue,
		};
	};

	// Function to start streaming camera data
	const startStreaming = useCallback(
		(stream) => {
			if (!stream || !videoRef.current || !canvasRef.current) {
				console.error("Missing required references for streaming");
				return;
			}

			console.log("Starting camera stream...");
			const video = videoRef.current;
			video.srcObject = stream;
			streamRef.current = stream;

			// Set up video event handlers
			video.onloadedmetadata = () => {
				console.log("Video metadata loaded, starting playback...");
				video
					.play()
					.then(() => {
						console.log("Video playback started successfully");
						processFrame();
						syncRecordingStatus(true);
					})
					.catch((error) => {
						console.error("Error playing video:", error);
						syncRecordingStatus(false);
					});
			};

			video.onplay = () => {
				console.log("Video playback started");
				syncRecordingStatus(true);
			};

			video.onerror = (error) => {
				console.error("Video error:", error);
				syncRecordingStatus(false);
				stopCamera();
			};

			// Add stream error handling
			stream.oninactive = () => {
				console.log("Stream became inactive");
				syncRecordingStatus(false);
				stopCamera();
			};
		},
		[processFrame, syncRecordingStatus, stopCamera]
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
			syncRecordingStatus(true);
			return true;
		} catch (error) {
			console.error("Camera permission request failed:", error);
			localStorage.setItem("cardboardhrv-was-recording", "false");
			setHasCameraAccess(false);
			syncRecordingStatus(false);
			return false;
		}
	}, [startStreaming, syncRecordingStatus]);

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
		syncRecordingStatus(false);
	}, [syncRecordingStatus]);

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
