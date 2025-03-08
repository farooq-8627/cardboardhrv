import React from "react";
import { Link } from "react-router-dom";

function Header() {
	return (
		<header className="app-header">
			<div className="logo">
				<Link to="/">
					<h1>CardboardHRV</h1>
				</Link>
			</div>
		</header>
	);
}

export default Header;
