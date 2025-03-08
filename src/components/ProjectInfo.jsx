import React from "react";
import { Link } from "react-router-dom";

function ProjectInfo() {
	return (
		<div className="project-info">
			<h2>About CardboardHRV</h2>

			<section className="info-section">
				<h3>Project Overview</h3>
				<p>
					CardboardHRV is an affordable and effective heart rate variability
					(HRV) biofeedback system leveraging Google Cardboard VR. Our system is
					designed to provide easy access to HRV biofeedback without sacrificing
					therapeutic value.
				</p>
				<p>
					By adapting the Google Cardboard VR headset with an optical fiber
					modification, we enable the camera of the inserted phone to capture
					the photoplethysmography (PPG) signal from the user's lateral
					forehead, allowing CardboardHRV to accurately calculate heart rate
					variability as a basis for biofeedback.
				</p>
			</section>

			<section className="info-section">
				<h3>System Components</h3>
				<div className="components-grid">
					<div className="component">
						<h4>Hardware</h4>
						<ul>
							<li>Google Cardboard VR headset</li>
							<li>Optical fiber attachment</li>
							<li>Smartphone (Android/iOS)</li>
						</ul>
					</div>
					<div className="component">
						<h4>Software</h4>
						<ul>
							<li>Mobile application for PPG capture</li>
							<li>Real-time signal processing algorithms</li>
							<li>Biofeedback visualization in VR</li>
							<li>This web interface for monitoring</li>
						</ul>
					</div>
				</div>
			</section>

			<section className="info-section">
				<h3>How It Works</h3>
				<ol className="workflow-steps">
					<li>
						<h4>Signal Capture</h4>
						<p>
							The smartphone's camera, positioned with an optical fiber
							attachment, captures photoplethysmography (PPG) signals from the
							user's forehead.
						</p>
					</li>
					<li>
						<h4>Signal Processing</h4>
						<p>
							Raw PPG signals are processed to detect individual heartbeats and
							calculate heart rate variability metrics.
						</p>
					</li>
					<li>
						<h4>Biofeedback</h4>
						<p>
							HRV data is visualized in an immersive VR environment, providing
							real-time feedback to guide breathing and promote coherence.
						</p>
					</li>
					<li>
						<h4>Monitoring</h4>
						<p>
							This web application allows researchers and practitioners to
							monitor sessions and analyze the collected data.
						</p>
					</li>
				</ol>
			</section>

			<section className="info-section">
				<h3>Benefits of HRV Biofeedback</h3>
				<div className="benefits-grid">
					<div className="benefit">
						<h4>Stress Reduction</h4>
						<p>
							Regular HRV biofeedback practice has been shown to reduce stress
							and anxiety levels.
						</p>
					</div>
					<div className="benefit">
						<h4>Improved Focus</h4>
						<p>
							HRV training can enhance attention, concentration, and cognitive
							performance.
						</p>
					</div>
					<div className="benefit">
						<h4>Better Sleep</h4>
						<p>
							Many users report improved sleep quality after consistent HRV
							biofeedback practice.
						</p>
					</div>
					<div className="benefit">
						<h4>Athletic Performance</h4>
						<p>
							Athletes use HRV biofeedback to optimize recovery and enhance
							performance.
						</p>
					</div>
				</div>
			</section>

			<div className="cta-section">
				<h3>Ready to try CardboardHRV?</h3>
				<Link to="/connect" className="cta-button">
					Connect Your Phone
				</Link>
			</div>
		</div>
	);
}

export default ProjectInfo;
