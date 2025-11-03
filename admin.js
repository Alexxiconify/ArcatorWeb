// Admin page utilities (modal close handling)

// Modal close buttons
document.querySelectorAll(".close-button").forEach((button) => {
    button.addEventListener("click", () => {
        document.getElementById("edit-temp-page-modal").style.display = "none";
        document.getElementById("edit-dm-modal").style.display = "none";
        document.getElementById("edit-form-modal").style.display = "none";
        document.getElementById("edit-user-modal").style.display = "none";
    });
});

// Close modals when clicking outside
window.addEventListener("click", (event) => {
    if (event.target === document.getElementById("edit-user-modal")) {
        document.getElementById("edit-user-modal").style.display = "none";
    }
    if (event.target === document.getElementById("edit-temp-page-modal")) {
        document.getElementById("edit-temp-page-modal").style.display = "none";
    }
});