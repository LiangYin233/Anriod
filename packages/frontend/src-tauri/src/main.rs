// Hide console window on Windows (GUI subsystem)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anriod_lib::run()
}
