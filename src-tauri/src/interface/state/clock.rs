use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_epoch_ms() -> u128 {
    let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return 0;
    };

    duration.as_millis()
}
