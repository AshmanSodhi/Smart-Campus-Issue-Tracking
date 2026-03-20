import { useEffect, useRef, useState } from "react";
import {
  autoCloseResolvedIssues,
  confirmResolution,
  getIssueImages,
  getNotifications,
  getStudentIssues,
  logout,
  markNotificationRead,
  saveImageReference,
  submitIssue,
  uploadIssueImage,
} from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import "./student.css";

function StudentDashboard() {
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [feedback, setFeedback] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [imageFile, setImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const titleInputRef = useRef(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        titleInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    await autoCloseResolvedIssues();

    const fetchedIssues = await getStudentIssues();
    setIssues(fetchedIssues);

    for (const issue of fetchedIssues) {
      const images = await getIssueImages(issue.id);
      setIssueImages((prev) => ({
        ...prev,
        [issue.id]: images,
      }));
    }

    const fetchedNotifications = await getNotifications();
    setNotifications(fetchedNotifications);
    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setPreviewImage(event.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title || !description || !location || !category) {
      setFeedback("Please fill all required fields before submitting.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitIssue({
        title,
        description,
        location,
        category,
        priority,
      });

      if (!result) {
        setFeedback("Issue submission failed. Please retry.");
        setLoading(false);
        return;
      }

      let issueId = null;
      if (Array.isArray(result) && result.length > 0) {
        issueId = result[0]?.id;
      }

      if (imageFile && issueId) {
        const imageUrl = await uploadIssueImage(imageFile, issueId);
        if (imageUrl) {
          await saveImageReference(issueId, imageUrl);
        }
      }

      setTitle("");
      setDescription("");
      setLocation("");
      setCategory("");
      setPriority("Medium");
      setImageFile(null);
      setPreviewImage(null);
      await loadDashboard();
      setFeedback("Issue submitted successfully. You can track updates in the table below.");
    } catch (error) {
      setFeedback(error.message || "Error submitting issue.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionAction = async (issueId, confirmed) => {
    setLoading(true);
    await confirmResolution(issueId, confirmed, resolutionNotes[issueId] || "");
    setResolutionNotes((prev) => ({ ...prev, [issueId]: "" }));
    await loadDashboard();
    setFeedback(confirmed ? "Issue closed. Thanks for confirming." : "Issue reopened for further work.");
    setLoading(false);
  };

  const markRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadDashboard();
  };

  const getStatusClass = (status) => {
    if (status === "Pending") return "status pending";
    if (status === "In Progress") return "status inprogress";
    if (status === "Resolved") return "status resolved";
    if (status === "Closed") return "status closed";
    return "status";
  };

  const pendingCount = issues.filter((issue) => issue.status === "Pending").length;
  const inProgressCount = issues.filter((issue) => issue.status === "In Progress").length;
  const resolvedOrClosedCount = issues.filter((issue) => issue.status === "Resolved" || issue.status === "Closed").length;

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Student Console</h2>
        <button>My Dashboard</button>
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
            <p className="breadcrumbs">Home / Student / Dashboard</p>
            <h1>Student Dashboard</h1>
            <p className="helper-text">Shortcut: press Alt + N to jump to the new issue form.</p>
          </div>
        </div>

        <div className="metrics-row" aria-label="Student summary">
          <article className="metric-card">
            <p>Total Issues</p>
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

        <div className="card">
          <h3>Notifications</h3>
          {notifications.length === 0 ? (
            <p>No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id} className={notification.is_read ? "notification read" : "notification unread"}>
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                  </div>
                  {!notification.is_read && <button onClick={() => markRead(notification.id)}>Mark read</button>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Raise New Issue</h3>
          <div className="form">
            <input
              ref={titleInputRef}
              placeholder="Issue Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />

            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />

            <input
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />

            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading}>
              <option value="">Category</option>
              <option>Electrical</option>
              <option>Plumbing</option>
              <option>Internet</option>
              <option>Cleaning</option>
              <option>Infrastructure</option>
            </select>

            <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={loading}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <div className="image-upload-section">
              <label>Upload Image (Optional):</label>
              <input type="file" accept="image/*" onChange={handleImageSelect} disabled={loading} />

              {previewImage && (
                <div className="image-preview">
                  <img src={previewImage} alt="Preview" />
                </div>
              )}
            </div>

            <button onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting..." : "Submit Issue"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>My Issues</h3>

          {loading ? (
            <p>Loading issues...</p>
          ) : issues.length === 0 ? (
            <p>No issues submitted yet.</p>
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
                  <th>Technician</th>
                  <th>Created</th>
                  <th>Images</th>
                  <th>Student Action</th>
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
                    <td>
                      <span className={getStatusClass(issue.status)}>{issue.status}</span>
                    </td>
                    <td>{issue.technician}</td>
                    <td>{new Date(issue.created_at).toLocaleString()}</td>
                    <td>
                      {issueImages[issue.id] && issueImages[issue.id].length > 0 ? (
                        <div className="image-gallery">
                          {issueImages[issue.id].map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImage(img.image_url)}
                              className="image-link"
                              title="Click to view image"
                            >
                              View
                            </button>
                          ))}
                        </div>
                      ) : (
                        "No images"
                      )}
                    </td>
                    <td>
                      {issue.status === "Resolved" ? (
                        <div className="verification-actions">
                          <input
                            placeholder="Optional note"
                            value={resolutionNotes[issue.id] || ""}
                            onChange={(e) =>
                              setResolutionNotes((prev) => ({
                                ...prev,
                                [issue.id]: e.target.value,
                              }))
                            }
                            disabled={loading}
                          />
                          <div className="verification-buttons">
                            <button disabled={loading} onClick={() => handleResolutionAction(issue.id, true)}>
                              Confirm
                            </button>
                            <button disabled={loading} onClick={() => handleResolutionAction(issue.id, false)}>
                              Reopen
                            </button>
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
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

export default StudentDashboard;
