function applyFontScalingSystem(userProfile) {
  const fontScale = userProfile?.fontScale || 1;
  const root = document.documentElement;
  root.style.fontSize = `${fontScale * 16}px`;

  if (userProfile?.highContrast) {
    root.style.setProperty('--color-text-primary', '#FFFFFF');
    root.style.setProperty('--color-bg-card', '#000000');
  }
}

function applyAccessibilitySettings(settings) {
  if (settings?.reducedMotion) {
    document.documentElement.style.setProperty('--transition-duration', '0s');
  }
}

function applyAdvancedSettings(settings) {
  if (settings?.customCSS) {
    applyCustomCSS(settings.customCSS);
  }
}

function applyCustomCSS(css) {
  let styleElement = document.getElementById('custom-user-css');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'custom-user-css';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

export async function loadAndApplyGlobalUserSettings(firebaseReadyPromise, getUserProfileFromFirestore, updateGlobalShortcuts) {
  try {
    await firebaseReadyPromise;

    if (window.auth && window.auth.currentUser) {
      const userProfile = await getUserProfileFromFirestore(window.auth.currentUser.uid);

      if (userProfile) {
        applyFontScalingSystem(userProfile);
        applyAccessibilitySettings(userProfile.accessibility);
        applyAdvancedSettings(userProfile.advanced);

        if (userProfile.keyboardShortcuts) {
          updateGlobalShortcuts(userProfile.keyboardShortcuts);
        }
      }
    }
  } catch (error) {
    console.error("Error loading user settings:", error);
  }
}