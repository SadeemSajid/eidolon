//! Trusted backend defaults and component assets; descriptions never supply code.
use serde_json::{Value, json};

pub const ARM_VIRT_BOARD: &str = "arm-virt-a55";
pub const GENERATOR: &str = include_str!("../../scripts/generate-bare-metal.py");

pub fn default_description(board_id: &str) -> Result<Value, String> {
    match board_id {
        ARM_VIRT_BOARD => serde_json::from_str(include_str!("../../platforms/arm-virt-a55.json"))
            .map_err(|error| error.to_string()),
        _ => Err("Only the Arm virt backend has a registered firmware target.".into()),
    }
}

pub fn component_assets() -> Value {
    json!({
        "arch/aarch64/startup.S": include_str!("../../firmware/arch/aarch64/startup.S"),
        "arch/aarch64/platform.c": include_str!("../../firmware/arch/aarch64/platform.c"),
        "include/platform.h": include_str!("../../firmware/include/platform.h"),
        "include/console.h": include_str!("../../firmware/include/console.h"),
        "drivers/pl011.c": include_str!("../../firmware/drivers/pl011.c"),
        "apps/hello.c.in": include_str!("../../firmware/apps/hello.c.in"),
        "templates/platform_config.h.in": include_str!("../../firmware/templates/platform_config.h.in"),
        "templates/linker.ld.in": include_str!("../../firmware/templates/linker.ld.in"),
    })
}
