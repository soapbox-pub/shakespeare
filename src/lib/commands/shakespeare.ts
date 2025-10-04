import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult } from "./ShellCommand";


const ASCII_QUILLY = `                               
                                                          
                                                          
                      @@@@@@%                            
                   @@       @@@                          
                 @@           @@@                        
                @@             @@@                       
                @@%%%   %@@@   @@@                       
              @@@@%@%@%  @@@@ %@@@@%                     
             @@@@@ @%%   @@   @@@@@@@                    
             @@@@@  @@         @@@@@@%                   
              @@@@  @%#@@      @@@@@@                    
                @@%@@@@@@@@  %@@@@@@%                    
              @@% @  @@@    %@%    @@                    
             @@   @@      %@@     @@                     
            @@      @@@%@@      %@@                      
            @@@@@%@@%@@@%#     @@                        
                @@@@@@@%@@@@@@@@ @@                      
                @@           @@  @@                      
                @@ @@@       @@  @@                      
                @@ @@@       @@  @@                      
                @@ @@@       @@  @@                      
                @@ @@@       @@  @@                      
                @@ @@@       @@  @@                      
                @@ @@@       @@  @@                      
                @@ %@@       @@  @@                      
                @@  @@@     @@@  @@                      
                @@   @@@@@@@@%   @@                      
                @@%     %@%     @@@                      
                 @@             @@                       
                  @@@         @@@                        
                   @@@@@@@@@@@@%                         
                        @@%                                                                                                             
`;

/**
 * Collection of Shakespeare poems
 * Replace these placeholders with actual Shakespeare sonnets/excerpts
 */
const POEMS = [
  `From The Phoenix and the Turtle

Here the anthem doth commence:
Love and constancy is dead;
Phoenix and the turtle fled
In a mutual flame from hence.

So they loved, as love in twain
Had the essence but in one;
Two distincts, division none:
Number there in love was slain.

Hearts remote, yet not asunder;
Distance, and no space was seen
'Twixt the turtle and his queen:
But in them it were a wonder.

So between them love did shine,
That the turtle saw his right
Flaming in the phoenix' sight;
Either was the other's mine.`,

  `From Romeo and Juliet - Act III, Scene 5; Capulet’s orchard

Juliet. Yon light is not day-light, I know it, I:
It is some meteor that the sun exhales,2110
To be to thee this night a torch-bearer,
And light thee on thy way to Mantua:
Therefore stay yet; thou need'st not to be gone.

Romeo. Let me be ta'en, let me be put to death;
I am content, so thou wilt have it so.2115
I'll say yon grey is not the morning's eye,
'Tis but the pale reflex of Cynthia's brow;
Nor that is not the lark, whose notes do beat
The vaulty heaven so high above our heads:
I have more care to stay than will to go:2120
Come, death, and welcome! Juliet wills it so.
How is't, my soul? let's talk; it is not day.

Juliet. It is, it is: hie hence, be gone, away!
It is the lark that sings so out of tune,
Straining harsh discords and unpleasing sharps.2125
Some say the lark makes sweet division;
This doth not so, for she divideth us:
Some say the lark and loathed toad change eyes,
O, now I would they had changed voices too!
Since arm from arm that voice doth us affray,2130
Hunting thee hence with hunt's-up to the day,
O, now be gone; more light and light it grows.

Romeo. More light and light; more dark and dark our woes!`,

  `From A lover's complaint

'Now all these hearts that do on mine depend,
Feeling it break, with bleeding groans they pine;
And supplicant their sighs to you extend,
To leave the battery that you make 'gainst mine,
Lending soft audience to my sweet design,280
And credent soul to that strong-bonded oath
That shall prefer and undertake my troth.'

'This said, his watery eyes he did dismount,
Whose sights till then were levell'd on my face;
Each cheek a river running from a fount285
With brinish current downward flow'd apace:
O, how the channel to the stream gave grace!
Who glazed with crystal gate the glowing roses
That flame through water which their hue encloses.

'O father, what a hell of witchcraft lies290
In the small orb of one particular tear!
But with the inundation of the eyes
What rocky heart to water will not wear?
What breast so cold that is not warmed here?
O cleft effect! cold modesty, hot wrath,295
Both fire from hence and chill extincture hath.`,
];

/**
 * Implementation of the 'shakespeare' command
 * Display ASCII art and a random Shakespeare poem - an easter egg!
 */
export class ShakespeareCommand implements ShellCommand {
  name = 'shakespeare';
  description = 'Display a quote from the Bard himself';
  usage = 'shakespeare';
  isEasterEgg = true;

  async execute(_args: string[], _cwd: string, _input?: string): Promise<ShellCommandResult> {
    // Get random poem
    const randomPoem = POEMS[Math.floor(Math.random() * POEMS.length)];

    // Combine ASCII art and poem
    const output = `${ASCII_QUILLY}

${randomPoem}

`;

    return createSuccessResult(output);
  }
}
