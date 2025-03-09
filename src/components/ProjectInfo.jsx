import React from "react";
import { Link } from "react-router-dom";

function ProjectInfo() {
	return (
		<div className="project-info">
			<h2>About CardboardHRV</h2>

			<section className="info-section">
				<h3>Project Overview</h3>
				<p>
					CardboardHRV is an innovative approach to heart rate variability (HRV)
					monitoring that uses a smartphone's camera with a specialized optical
					fiber attachment. Our system transforms any modern smartphone into a
					precise HRV monitoring device, making this valuable health metric
					accessible to everyone.
				</p>
				<p>
					By positioning the smartphone's camera with an optical fiber to
					capture photoplethysmography (PPG) signals from the lateral forehead,
					we can accurately measure heart rate variability without the need for
					expensive specialized equipment.
				</p>
			</section>

			<section className="info-section">
				<h3>System Components</h3>
				<div className="components-grid">
					<div className="component">
						<h4>Hardware Setup</h4>
						<ul>
							<li>Smartphone with camera</li>
							<li>Custom optical fiber attachment</li>
							<li>Adjustable head mount</li>
							<li>Light-blocking enclosure</li>
						</ul>
					</div>
					<div className="component">
						<h4>Software Components</h4>
						<ul>
							<li>Real-time PPG signal processing</li>
							<li>HRV analysis algorithms</li>
							<li>Web-based monitoring interface</li>
							<li>Cross-device data synchronization</li>
						</ul>
					</div>
				</div>
			</section>

			<section className="info-section">
				<h3>Technical Workflow</h3>
				<ol className="workflow-steps">
					<li>
						<h4>Signal Acquisition</h4>
						<p>
							The optical fiber guides light to and from the lateral forehead,
							allowing the smartphone camera to capture subtle blood volume
							changes through PPG.
						</p>
					</li>
					<li>
						<h4>Data Processing</h4>
						<p>
							Raw PPG signals undergo real-time processing to extract
							beat-to-beat intervals and calculate heart rate variability
							metrics.
						</p>
					</li>
					<li>
						<h4>HRV Analysis</h4>
						<p>
							Advanced algorithms compute key HRV parameters including SDNN,
							RMSSD, and frequency domain measures (LF, HF, LF/HF ratio).
						</p>
					</li>
					<li>
						<h4>Real-time Monitoring</h4>
						<p>
							Processed data is displayed on a web dashboard, allowing immediate
							visualization of HRV metrics and trends.
						</p>
					</li>
				</ol>
			</section>

			<section className="info-section">
				<h3>Applications & Benefits</h3>
				<div className="benefits-grid">
					<div className="benefit">
						<h4>Research Applications</h4>
						<p>
							Enables large-scale HRV studies with minimal hardware requirements
							and standardized data collection.
						</p>
					</div>
					<div className="benefit">
						<h4>Clinical Assessment</h4>
						<p>
							Provides a cost-effective tool for preliminary HRV assessment in
							clinical settings.
						</p>
					</div>
					<div className="benefit">
						<h4>Personal Health Monitoring</h4>
						<p>
							Allows individuals to track their HRV trends using their own
							smartphone.
						</p>
					</div>
					<div className="benefit">
						<h4>Accessibility</h4>
						<p>
							Makes HRV monitoring accessible to a wider population through
							affordable technology.
						</p>
					</div>
				</div>
			</section>

			<section className="info-section">
				<h3>Technical Specifications</h3>
				<div className="specs-grid">
					<div className="spec">
						<h4>Signal Processing</h4>
						<ul>
							<li>30 FPS video processing</li>
							<li>Real-time PPG extraction</li>
							<li>Adaptive noise filtering</li>
							<li>Beat detection algorithms</li>
						</ul>
					</div>
					<div className="spec">
						<h4>HRV Metrics</h4>
						<ul>
							<li>Time-domain: SDNN, RMSSD</li>
							<li>Frequency-domain: LF, HF, LF/HF</li>
							<li>Real-time calculation</li>
							<li>Data validation checks</li>
						</ul>
					</div>
				</div>
			</section>

			<div className="cta-section">
				<h3>Ready to try CardboardHRV?</h3>
				<p>
					Experience accurate HRV monitoring using your smartphone's camera with
					our innovative optical setup.
				</p>
				<Link to="/connect" className="cta-button">
					Start Monitoring
				</Link>
			</div>
		</div>
	);
}

export default ProjectInfo;
