import { useState, useEffect } from "react";
import { logout, getRole } from "../services/authService";
import { useNavigate } from "react-router-dom";
import "./student.css";

function StudentDashboard() {

  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {

    if (getRole() !== "student") {
      navigate("/");
    }

    loadIssues();

  }, []);

  const loadIssues = () => {

    const storedIssues =
      JSON.parse(localStorage.getItem("studentIssues")) || [];

    setIssues(storedIssues);
  };

  const handleSubmit = () => {

    if (!title || !description || !location || !category) {
      alert("Fill all fields");
      return;
    }

    const newIssue = {
        id: Date.now(),
        title,
        description,
        location,
        category,
        status: "Pending",
        technician: "Not Assigned",
        date: new Date().toLocaleString()
    };


    const updated = [...issues, newIssue];

    localStorage.setItem(
      "studentIssues",
      JSON.stringify(updated)
    );

    setIssues(updated);

    setTitle("");
    setDescription("");
    setLocation("");
    setCategory("");
  };

  const getStatusClass = (status) => {

    if (status === "Pending") return "status pending";
    if (status === "In Progress") return "status inprogress";
    if (status === "Resolved") return "status resolved";

    return "status";
  };

  return (

    <div className="dashboard-container">

      {/* Sidebar */}

      <div className="sidebar">

        <h2>Smart Campus</h2>

        <button>
          Dashboard
        </button>

        <button onClick={() => {
          logout();
          navigate("/");
        }}>
          Logout
        </button>

      </div>


      {/* Main Content */}

      <div className="main-content">

        <div className="header">

          <h1>Student Dashboard</h1>

        </div>


        {/* Raise Issue */}

        <div className="card">

          <h3>Raise New Issue</h3>

          <div className="form">

            <input
              placeholder="Issue Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <input
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Category</option>
              <option>Electrical</option>
              <option>Plumbing</option>
              <option>Internet</option>
              <option>Cleaning</option>
              <option>Infrastructure</option>
            </select>

            <button onClick={handleSubmit}>
              Submit Issue
            </button>

          </div>

        </div>


        {/* Issues Table */}

        <div className="card">

          <h3>My Issues</h3>

          <table>

            <thead>

              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Date</th>
                <th>Technician</th>
              </tr>

            </thead>

            <tbody>

              {issues.map(issue => (

                <tr key={issue.id}>

                  <td>{issue.id}</td>
                  <td>{issue.title}</td>
                  <td>{issue.category}</td>
                  <td>{issue.location}</td>

                  <td>
                    <span className={
                      getStatusClass(issue.status)
                    }>
                      {issue.status}
                    </span>
                  </td>

                  <td>{issue.date}</td>
                  <td>{issue.technician}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );
}

export default StudentDashboard;
