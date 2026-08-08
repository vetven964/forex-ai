// Function to calculate exact Active Session based on UTC Time
function updateActiveSession() {
    const now = new Date();
    const utcHours = now.getUTCHours();
    
    let sessionName = "ASIAN (Tokyo/Sydney)";
    
    // Session UTC mapping:
    // Asian: 00:00 - 08:00 UTC
    // London: 08:00 - 16:00 UTC
    // New York: 13:00 - 21:00 UTC (Overlap handled smoothly)
    
    if (utcHours >= 0 && utcHours < 8) {
        sessionName = "ASIAN Session 🇯🇵";
    } else if (utcHours >= 8 && utcHours < 13) {
        sessionName = "London Session 🇬🇧";
    } else if (utcHours >= 13 && utcHours < 21) {
        sessionName = "New York / London 🇺🇸🇬🇧";
    } else {
        sessionName = "Pacific / Off-Hours 🇦🇺";
    }

    const sessionElement = document.getElementById("active-session");
    if (sessionElement) {
        sessionElement.innerText = sessionName;
    }
}

// Run on load
document.addEventListener("DOMContentLoaded", () => {
    updateActiveSession();
    // Update every minute
    setInterval(updateActiveSession, 60000);
});