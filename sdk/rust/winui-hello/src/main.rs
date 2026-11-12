// WinUI 3 en Rust avec windows-reactor (windows-rs crates/libs/reactor, readme « Get started ») : composant, messages typés,
// réconciliation des contrôles. Dépend du framework Windows App Runtime 2 >= 2.6.4 installé (bootstrap de reactor) ;
// sans lui, reactor affiche la boîte d'installation. Variante autonome : build-dependency windows-reactor-setup.
#![windows_subsystem = "windows"]

use windows_reactor::*;

#[derive(Clone, Copy)]
enum Message {
    Increment,
    Reset,
}

struct Hello {
    count: i32,
}

impl Component for Hello {
    type Input = ();
    type Message = Message;

    fn create(_input: &(), _context: &ComponentContext<Self>) -> Self {
        Self { count: 0 }
    }

    fn update(&mut self, message: Message, _context: &ComponentContext<Self>) {
        match message {
            Message::Increment => self.count += 1,
            Message::Reset => self.count = 0,
        }
    }

    fn view(&self, _input: &(), context: &mut ViewContext<Self>) -> View {
        let content = StackPanel::new().spacing(8.0).children((
            format!("nt — WinUI 3 depuis Rust : {}", self.count),
            Button::new()
                .on_click(context.message(Message::Increment))
                .content("+1"),
            Button::new()
                .on_click(context.message(Message::Reset))
                .content("Remise à zéro"),
        ));
        context.window_frame("nt", content)
    }
}

fn main() {
    App::run_component::<Hello>(()).unwrap();
}
