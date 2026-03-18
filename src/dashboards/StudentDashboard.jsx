import { useState, useEffect } from "react";
import { logout, getRole } from "../services/supabaseService";
import { 
  submitIssue, 
  getStudentIssues, 
  uploadIssueImage, 
  saveImageReference,
  getIssueImages 
} from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import "./student.css";

function StudentDashboard() {

  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {

    if (getRole() !== "student") {
      navigate("/");
    }

    loadIssues();

  }, []);

  const loadIssues = async () => {

    setLoading(true);
    const fetchedIssues = await getStudentIssues();
    setIssues(fetchedIssues);

    // Load images for each issue
    for (const issue of fetchedIssues) {
      const images = await getIssueImages(issue.id);
      setIssueImages(prev => ({
        ...prev,
        [issue.id]: images
      }));
    }

    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {

    if (!title || !description || !location || !category) {
      alert("Fill all fields");
      return;
    }

    setLoading(true);

    try {
      // Debug: Check if email exists
      const email = localStorage.getItem("userEmail");
      if (!email) {
        alert("Error: User email not found. Please login again.");
        setLoading(false);
        return;
      }

      console.log("🚀 [handleSubmit] Starting submission...");

      // Submit issue to Supabase
      const result = await submitIssue({
        title,
        description,
        location,
        category
      });

      console.log("📋 [handleSubmit] submitIssue returned:", result);
      console.log("📋 [handleSubmit] Result type:", typeof result);
      console.log("📋 [handleSubmit] Result is array:", Array.isArray(result));
      console.log("📋 [handleSubmit] Result truthiness:", !!result);

      // Even if result is empty array, consider it success
      const isSuccess = result !== null && result !== undefined;
      console.log("📋 [handleSubmit] isSuccess:", isSuccess);

      if (isSuccess) {
        // Get the issue ID from the result
        let issueId = null;
        if (Array.isArray(result) && result.length > 0) {
          issueId = result[0]?.id;
        } else if (result && result.id) {
          issueId = result.id;
        }

        console.log("✅ Issue created with ID:", issueId);

        let imageUploadError = null;

        // Upload image if selected
        if (imageFile && issueId) {
          console.log("📸 Uploading image for issue:", issueId);
          try {
            const imageUrl = await uploadIssueImage(imageFile, issueId);
            
            if (imageUrl) {
              console.log("✅ Image uploaded, saving reference...");
              await saveImageReference(issueId, imageUrl);
              console.log("✅ Image reference saved");
            } else {
              console.warn("⚠️ Image upload returned null URL");
              imageUploadError = "Image upload failed - no URL returned";
            }
          } catch (imgErr) {
            console.error("❌ Image upload error:", imgErr);
            imageUploadError = "Image upload error: " + (imgErr.message || imgErr);
          }
        }

        // Reload issues
        console.log("🔄 Reloading issues...");
        await loadIssues();
        console.log("✅ Issues reloaded");

        // Clear form
        setTitle("");
        setDescription("");
        setLocation("");
        setCategory("");
        setImageFile(null);
        setPreviewImage(null);

        if (imageUploadError) {
          alert("✅ Issue submitted successfully!\n\n⚠️ " + imageUploadError + "\n\nYou can still view the issue and add images later.");
        } else if (imageFile) {
          alert("✅ Issue submitted successfully with image!");
        } else {
          alert("✅ Issue submitted successfully!");
        }
      } else {
        console.error("❌ [handleSubmit] Result is null/undefined");
        alert("Error submitting issue - result was null");
      }
    } catch (error) {
      console.error("❌ Error in handleSubmit:", error);
      console.error("   Error type:", error.constructor.name);
      console.error("   Error message:", error.message);
      console.error("   Full error:", error);
      alert("Error submitting issue:\n" + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
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

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              <option value="">Category</option>
              <option>Electrical</option>
              <option>Plumbing</option>
              <option>Internet</option>
              <option>Cleaning</option>
              <option>Infrastructure</option>
            </select>

            <div className="image-upload-section">
              <label>Upload Image (Optional):</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={loading}
              />
              
              {previewImage && (
                <div className="image-preview">
                  <img src={previewImage} alt="Preview" />
                </div>
              )}
            </div>

            <button 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Issue"}
            </button>

          </div>

        </div>


        {/* Issues Table */}

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
                  <th>Location</th>
                  <th>Status</th>
                  <th>Technician</th>
                  <th>Created</th>
                  <th>Images</th>
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
                              📷 View
                            </button>
                          ))}
                        </div>
                      ) : (
                        "No images"
                      )}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>
          )}

        </div>

      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>✕</button>
            <img src={selectedImage} alt="Issue" className="modal-image" />
          </div>
        </div>
      )}

    </div>

  );
}

export default StudentDashboard;
