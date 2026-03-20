import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIssueImages,
  getTechnicianIssues,
  logout,
  updateIssueStatus,
} from "../services/supabaseService";
import "./admin.css";

function TechnicianDashboard() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [completionNotes, setCompletionNotes] = useState({});
  const [feedback, setFeedback] = useState("");
  const [lastStatusChange, setLastStatusChange] = useState(null);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setLoading(true);
    const fetchedIssues = await getTechnicianIssues();
    setIssues(fetchedIssues);

    for (const issue of fetchedIssues) {
      const images = await getIssueImages(issue.id);
      setIssueImages((prev) => ({
        ...prev,
        [issue.id]: images,
      }));
    }

    setLoading(false);
  };

  const handleStatusChange = async (issue, status) => {
    if (status === "Closed" && !window.confirm("Close this issue? You can undo this change.")) {
      return;
    }

    setLoading(true);
    const note = completionNotes[issue.id] || "";
    await updateIssueStatus(issue.id, status, note);

    if (status === "Resolved") {
      setCompletionNotes((prev) => ({ ...prev, [issue.id]: "" }));
    }

    await loadIssues();
    if (issue.status !== status) {
      setLastStatusChange({ id: issue.id, previousStatus: issue.status });
    }
    setFeedback(`Issue #${issue.id} moved to ${status}.`);
    setLoading(false);
  };

  const undoLastStatusChange = async () => {
    if (!lastStatusChange) {
      return;
    }

    setLoading(true);
    await updateIssueStatus(lastStatusChange.id, lastStatusChange.previousStatus);
    await loadIssues();
    setFeedback(`Reverted issue #${lastStatusChange.id} to ${lastStatusChange.previousStatus}.`);
    setLastStatusChange(null);
    setLoading(false);
  };

  const pendingCount = issues.filter((issue) => issue.status === "Pending").length;
  const inProgressCount = issues.filter((issue) => issue.status === "In Progress").length;
  const resolvedOrClosedCount = issues.filter((issue) => issue.status === "Resolved" || issue.status === "Closed").length;

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Technician Console</h2>
        <button>Assigned Queue</button>
        <button
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Logout
        </button>
      </div>

      <div className="main-content">
        <div className="header">
          <div>
            <p className="breadcrumbs">Home / Technician / Assigned Issues</p>
            <h1>Technician Dashboard</h1>
            <p className="helper-text">Add completion notes before moving a task to Resolved.</p>
          </div>
        </div>

        <div className="metrics-row" aria-label="Technician summary">
          <article className="metric-card">
            <p>Assigned</p>
            <strong>{issues.length}</strong>
          </article>
          <article className="metric-card">
            <p>Pending</p>
            <strong>{pendingCount}</strong>
          </article>
          <article className="metric-card">
            <p>In Progress</p>
            <strong>{inProgressCount}</strong>
          </article>
          <article className="metric-card">
            <p>Resolved / Closed</p>
            <strong>{resolvedOrClosedCount}</strong>
          </article>
        </div>

        {feedback && <div className="feedback-banner" role="status">{feedback}</div>}
        {lastStatusChange && (
          <div className="feedback-banner warning" role="status">
            Last update can be reversed.
            <button className="ghost-action" onClick={undoLastStatusChange} disabled={loading}>
              Undo Status Change
            </button>
          </div>
        )}

        <div className="card">
          <h3>My Assigned Issues</h3>
          {loading ? (
            <p>Loading issues...</p>
          ) : issues.length === 0 ? (
            <p>No issues assigned yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Student</th>
                  <th>Images</th>
                  <th>Completion Note</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.id}</td>
                    <td>{issue.title}</td>
                    <td>{issue.category}</td>
                    <td>{issue.priority || "Medium"}</td>
                    <td>{issue.location}</td>
                    <td>{issue.status}</td>
                    <td>{issue.student_email}</td>
                    <td>
                      {issueImages[issue.id] && issueImages[issue.id].length > 0 ? (
                        <div className="image-gallery">
                          {issueImages[issue.id].map((img, idx) => (
                            <button key={idx} onClick={() => setSelectedImage(img.image_url)} className="image-link">
                              View
                            </button>
                          ))}
                        </div>
                      ) : (
                        "No images"
                      )}
                    </td>
                    <td>
                      <input
                        placeholder="Add completion details"
                        value={completionNotes[issue.id] || ""}
                        onChange={(e) =>
                          setCompletionNotes((prev) => ({
                            ...prev,
                            [issue.id]: e.target.value,
                          }))
                        }
                        disabled={loading || issue.status === "Closed"}
                      />
                    </td>
                    <td>
                      <select
                        value={issue.status}
                        onChange={(e) => handleStatusChange(issue, e.target.value)}
                        disabled={loading || issue.status === "Closed"}
                      >
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Resolved</option>
                        <option>Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>
              X
            </button>
            <img src={selectedImage} alt="Issue" className="modal-image" />
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicianDashboard;
