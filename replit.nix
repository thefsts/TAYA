{pkgs}: {
  deps = [
    pkgs.glib
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.mesa
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.dbus
    pkgs.nspr
    pkgs.nss
    pkgs.xorg.libXtst
    pkgs.xorg.libXrender
    pkgs.xorg.libXi
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcursor
    pkgs.xorg.libXcomposite
    pkgs.xorg.libxcb
    pkgs.xorg.libX11
    pkgs.chromium
  ];
}
