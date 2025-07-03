import {auth, DEFAULT_PROFILE_PIC, firebaseReadyPromise, getUserProfileFromFirestore,} from "./firebase-init.js";
import {loadFooter, loadNavbar} from "./navbar.js";
import {applyCachedTheme, applyTheme, getAvailableThemes,} from "./themes.js";

// Apply cached theme immediately to prevent flash
applyCachedTheme();

firebaseReadyPromise.then(() => {
  auth.onAuthStateChanged(async (user) => {
    let userProfile = null;
    if (user) {
      userProfile = await getUserProfileFromFirestore(user.uid);
    }
    await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, "dark");
    loadFooter("current-year-forms");
    const userThemePreference = userProfile?.themePreference;
    const allThemes = await getAvailableThemes();
    const themeToApply =
      allThemes.find((t) => t.id === userThemePreference) ||
      allThemes.find((t) => t.id === "dark");
    if (themeToApply) {
      applyTheme(themeToApply.id, themeToApply);
      console.log(
        `Forms page: Applied theme ${themeToApply.id} (${themeToApply.name})`,
      );
    }
  });
});
