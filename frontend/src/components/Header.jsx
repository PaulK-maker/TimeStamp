// import React from "react";

// const Header = () => {
//   return (
//     <header style={{ padding: "10px", backgroundColor: "#333", color: "#fff" }}>
//       <h1>Admin Dashboard</h1>
//     </header>
//   );
// };

// export default Header;

import React from "react";

const Header = ({ title = "Admin Dashboard" }) => (
  <header style={{ padding: "10px", backgroundColor: "#333", color: "#fff" }}>
    <h1>{title}</h1>
  </header>
);

export default Header;