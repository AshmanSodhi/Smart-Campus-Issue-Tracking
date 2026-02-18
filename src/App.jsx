import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import StudentDashboard from "./dashboards/StudentDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


/* export default App; */
