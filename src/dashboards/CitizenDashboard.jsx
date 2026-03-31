import { useEffect, useRef, useState } from "react";
import {
  autoCloseResolvedIssues,
  confirmResolution,
  getIssueImages,
  getNotifications,
  getCitizenIssues,
  logout,
  markNotificationRead,
  saveImageReference,
  submitIssue,
  submitAdditionalInfo,
  uploadIssueImage,
} from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import { APP_CONFIG, getStatusBadgeClass } from "../config/appConfig";
import "./citizen.css";

function CitizenDashboard() {
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [additionalInfo, setAdditionalInfo] = useState({});
  const [additionalImages, setAdditionalImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [feedback, setFeedback] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState(APP_CONFIG.PRIORITIES.MEDIUM);
  const [imageFile, setImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const titleInputRef = useRef(null);
  const notificationPanelRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target)) {
        setShowNotificationPanel(false);
      }
    };

    if (showNotificationPanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotificationPanel]);

  const loadDashboard = async () => {
    setLoading(true);
    await autoCloseResolvedIssues();

    const fetchedIssues = await getCitizenIssues();
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
    const unreadCount = fetchedNotifications.filter((n) => !n.is_read).length;
    setUnreadNotificationCount(unreadCount);
    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (file.size > APP_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setFeedback(`Image size exceeds ${APP_CONFIG.MAX_IMAGE_SIZE_MB}MB limit.`);
      return;
    }

    if (!APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFeedback("Please upload a valid image (JPEG, PNG, or WebP).");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setPreviewImage(event.target.result);
    reader.readAsDataURL(file);
  };

  const handleAdditionalImageSelect = (e, issueId) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (file.size > APP_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setFeedback(`Image size exceeds ${APP_CONFIG.MAX_IMAGE_SIZE_MB}MB limit.`);
      return;
    }

    if (!APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFeedback("Please upload a valid image (JPEG, PNG, or WebP).");
      return;
    }

    setAdditionalImages((prev) => ({
      ...prev,
      [issueId]: file,
    }));
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
      setPriority(APP_CONFIG.PRIORITIES.MEDIUM);
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

  const handleSubmitAdditionalInfo = async (issueId) => {
    const infoText = additionalInfo[issueId]?.trim() || "";
    const infoImage = additionalImages[issueId];

    if (!infoText && !infoImage) {
      setFeedback("Please provide additional information or upload an image.");
      return;
    }

    setLoading(true);
    try {
      if (infoImage) {
        const imageUrl = await uploadIssueImage(infoImage, issueId);
        if (imageUrl) {
          await saveImageReference(issueId, imageUrl);
        }
      }

      if (infoText) {
        await submitAdditionalInfo(issueId, infoText);
      }

      setAdditionalInfo((prev) => ({ ...prev, [issueId]: "" }));
      setAdditionalImages((prev) => ({ ...prev, [issueId]: null }));
      await loadDashboard();
      setFeedback("Additional information submitted successfully.");
    } catch (error) {
      setFeedback(error.message || "Failed to submit additional information.");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadDashboard();
  };

  const getStatusClass = (status) => {
    return `status ${getStatusBadgeClass(status)}`;
  };

  const pendingCount = issues.filter(
    (issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.PENDING
  ).length;
  const inProgressCount = issues.filter(
    (issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.IN_PROGRESS
  ).length;
  const resolvedOrClosedCount = issues.filter(
    (issue) =>
      issue.status === APP_CONFIG.ISSUE_STATUSES.RESOLVED ||
      issue.status === APP_CONFIG.ISSUE_STATUSES.CLOSED
  ).length;

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Citizen Dashboard</h2>
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
            <p className="breadcrumbs">Home / Citizen / Dashboard</p>
            <h1>Citizen Dashboard</h1>
            <p className="helper-text">Shortcut: press Alt + N to jump to the new issue form.</p>
          </div>
          <div className="notification-bell-container" ref={notificationPanelRef}>
            <button
              className="notification-bell"
              onClick={() => setShowNotificationPanel(!showNotificationPanel)}
              title="View notifications"
            >
              🔔
              {unreadNotificationCount > 0 && (
                <span className="notification-badge">{unreadNotificationCount}</span>
              )}
            </button>
            {showNotificationPanel && (
              <div className="notification-dropdown">
                <h4>Notifications</h4>
                {notifications.length === 0 ? (
                  <p className="no-notifications">No notifications</p>
                ) : (
                  <ul className="notification-list">
                    {notifications.slice(0, APP_CONFIG.NOTIFICATION_DISPLAY_COUNT).map((notification) => (
                      <li
                        key={notification.id}
                        className={notification.is_read ? "notification read" : "notification unread"}
                      >
                        <div>
                          <strong>{notification.title}</strong>
                          <p>{notification.message}</p>
                        </div>
                        {!notification.is_read && (
                          <button onClick={() => markRead(notification.id)}>✓</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="metrics-row" aria-label="Citizen summary">
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
          <h3>Raise New Issue</h3>
          <div className="form">
            <input
              id="issueTitle"
              name="issueTitle"
              ref={titleInputRef}
              placeholder="Issue Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />

            <textarea
              id="issueDescription"
              name="issueDescription"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />

            <input
              id="issueLocation"
              name="issueLocation"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />

            <select id="issueCategory" name="issueCategory" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading}>
              <option value="">Category</option>
              {Object.values(APP_CONFIG.CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select id="issuePriority" name="issuePriority" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={loading}>
              {Object.values(APP_CONFIG.PRIORITIES).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <div className="image-upload-section">
              <label htmlFor="issueImage">Upload Image (Optional):</label>
              <input id="issueImage" name="issueImage" type="file" accept="image/*" onChange={handleImageSelect} disabled={loading} />

              {previewImage && (
                <div className="image-preview">
                  <img src={previewImage} alt="Preview" />
                </div>
              )}
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
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
                  <th>Assigned Officer</th>
                  <th>Created</th>
                  <th>Images</th>
                  <th>Citizen Action</th>
                </tr>
              </thead>

              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.id}</td>
                    <td>{issue.title}</td>
                    <td>{issue.category}</td>
                    <td>{issue.priority || APP_CONFIG.PRIORITIES.MEDIUM}</td>
                    <td>{issue.location}</td>
                    <td>
                      <span className={getStatusClass(issue.status)}>{issue.status}</span>
                    </td>
                    <td>{issue.technician || APP_CONFIG.DEFAULT_NOT_ASSIGNED}</td>
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
                      {issue.status === APP_CONFIG.ISSUE_STATUSES.RESOLVED ? (
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
                            <button
                              disabled={loading}
                              onClick={() => handleResolutionAction(issue.id, true)}
                              className="btn-confirm"
                            >
                              Confirm
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => handleResolutionAction(issue.id, false)}
                              className="btn-reopen"
                            >
                              Reopen
                            </button>
                          </div>
                        </div>
                      ) : issue.status === APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED ? (
                        <div className="verification-actions">
                          <div className="more-info-request">
                            <p className="info-message">{issue.more_info_request}</p>
                          </div>
                          <input
                            placeholder="Provide additional information"
                            value={additionalInfo[issue.id] || ""}
                            onChange={(e) =>
                              setAdditionalInfo((prev) => ({
                                ...prev,
                                [issue.id]: e.target.value,
                              }))
                            }
                            disabled={loading}
                          />
                          <label>
                            Upload image (optional):
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleAdditionalImageSelect(e, issue.id)}
                              disabled={loading}
                            />
                          </label>
                          <button
                            disabled={loading}
                            onClick={() => handleSubmitAdditionalInfo(issue.id)}
                            className="btn-submit-info"
                          >
                            Submit Info
                          </button>
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

export default CitizenDashboard;
