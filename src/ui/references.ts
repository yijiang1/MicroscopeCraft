// Sources behind the game's numbers and history, shown in the journal's References tab.
export interface Reference {
  text: string;
  url?: string;
}

export const REFERENCES: Record<string, Reference[]> = {
  'Light optics and the eye': [
    { text: 'E. Abbe (1873). Beiträge zur Theorie des Mikroskops und der mikroskopischen Wahrnehmung. Archiv für mikroskopische Anatomie 9, 413–468.' },
    { text: 'A. Köhler (1893). Ein neues Beleuchtungsverfahren für mikrophotographische Zwecke. Zeitschrift für wissenschaftliche Mikroskopie 10, 433–440.' },
    { text: 'F. Zernike (1942). Phase contrast, a new method for the microscopic observation of transparent objects. Physica 9, 686–698.' },
    { text: 'Resolution limit of the eye: how many pixels can we see? (2024). arXiv:2410.06068.', url: 'https://arxiv.org/pdf/2410.06068' },
    { text: 'Physics 123, Chapter 25 notes: the eye and optical instruments (Salisbury University).', url: 'https://faculty.salisbury.edu/~jwhoward/Physics123/html/ch25.htm' },
    { text: 'NIOS Senior Secondary Physics, Optical instruments (near point 25 cm).', url: 'https://www.nios.ac.in/media/documents/SrSec312NEW/Learner_Guide/Eng/312_LG_E_L23.pdf' },
  ],
  'Electron microscopy': [
    { text: 'M. Knoll, E. Ruska (1932). Das Elektronenmikroskop. Zeitschrift für Physik 78, 318–339.' },
    { text: 'O. Scherzer (1949). The theoretical resolution limit of the electron microscope. Journal of Applied Physics 20, 20–29.' },
    { text: 'A. V. Crewe, J. Wall, J. Langmore (1970). Visibility of single atoms. Science 168, 1338–1340.' },
    { text: 'M. Haider et al. (1998). Electron microscopy image enhanced. Nature 392, 768–769.' },
    { text: 'O. L. Krivanek, N. Dellby, A. R. Lupini (1999). Towards sub-Å electron beams. Ultramicroscopy 78, 1–11.' },
    { text: 'D. B. Williams, C. B. Carter (2009). Transmission Electron Microscopy, 2nd ed. Springer. (Relativistic wavelength, CTF, alignment.)' },
  ],
  Ptychography: [
    { text: 'A. M. Maiden, J. M. Rodenburg (2009). An improved ptychographical phase retrieval algorithm for diffractive imaging. Ultramicroscopy 109, 1256–1262.' },
    { text: 'Y. Jiang et al. (2018). Electron ptychography of 2D materials to deep sub-ångström resolution. Nature 559, 343–349.' },
    { text: 'Cornell Chronicle: EMPAD and the record resolution.', url: 'https://news.cornell.edu/index%2ephp/node/302026' },
  ],
  'X-rays, tomography and CHESS': [
    { text: 'W. C. Röntgen (1895). Über eine neue Art von Strahlen. Sitzungsberichte der Physikalisch-Medicinischen Gesellschaft zu Würzburg.' },
    { text: 'W. L. Bragg (1913). The diffraction of short electromagnetic waves by a crystal. Proceedings of the Cambridge Philosophical Society 17, 43–57.' },
    { text: 'A. C. Thompson et al. X-ray Data Booklet (LBNL). (Absorption edges, undulator harmonics.)', url: 'https://xdb.lbl.gov/' },
    { text: 'G. N. Ramachandran, A. V. Lakshminarayanan (1971). Three-dimensional reconstruction from radiographs and electron micrographs. PNAS 68, 2236–2240.' },
    { text: 'A. C. Kak, M. Slaney (1988). Principles of Computerized Tomographic Imaging. IEEE Press.' },
    { text: 'Accelerator Design for the CHESS-U Upgrade (2018). arXiv:1810.06557.', url: 'https://ar5iv.arxiv.org/html/1810.06557' },
    { text: 'Construction of CHESS compact undulator magnets at Kyma (2015). Proc. SPIE 9512, 951205.', url: 'https://proceedings.spiedigitallibrary.org/conference-proceedings-of-spie/9512/951205/Construction-of-CHESS-compact-undulator-magnets-at-Kyma/10.1117/12.2186301.full' },
    { text: 'The driving force behind Cornell compact undulators at CHESS (lightsources.org, 2019).', url: 'https://lightsources.org/2019/10/15/the-driving-force-behind-cornell-compact-undulators-at-chess/' },
    { text: 'CHESS beamline directory.', url: 'https://www.chess.cornell.edu/node/889' },
    { text: 'CHESS FMB beamline (X-ray fluorescence microscopy).', url: 'https://www.chess.cornell.edu/index.php/beamlines-focus-fmb' },
    { text: 'The history of science at the Cornell High Energy Synchrotron Source.', url: 'https://www.chess.cornell.edu/about/news/history-science-cornell-high-energy-synchrotron-source' },
    { text: 'Wilson Laboratory (CLASSE).', url: 'https://www.classe.cornell.edu/public/lab-info/wilson.html' },
    { text: 'Boris Batterman dies at age 80 (Cornell Chronicle, 2011).', url: 'https://www.news.cornell.edu/stories/2011/01/boris-batterman-dies-age-80' },
  ],
  'Discoveries of the scientists': [
    { text: 'R. Hooke (1665). Micrographia. London: Royal Society.' },
    { text: 'A. van Leeuwenhoek (1677). Observations concerning little animals. Philosophical Transactions 12, 821–831.' },
    { text: "Leeuwenhoek's green streaks (Lens on Leeuwenhoek).", url: 'https://www.lensonleeuwenhoek.net/node/9620' },
    { text: 'R. Brown (1833). On the organs and mode of fecundation in Orchideae and Asclepiadeae. Transactions of the Linnean Society 16, 685–745. (The nucleus.)' },
    { text: 'H. C. Gram (1884). Über die isolirte Färbung der Schizomyceten in Schnitt- und Trockenpräparaten. Fortschritte der Medicin 2, 185–189.' },
    { text: 'S. Ramón y Cajal (1899–1904). Textura del sistema nervioso del hombre y de los vertebrados. Madrid.' },
    { text: 'R. E. Franklin, R. G. Gosling (1953). Molecular configuration in sodium thymonucleate. Nature 171, 740–741.' },
    { text: 'D. C. Hodgkin et al. (1956). Structure of vitamin B12. Nature 178, 64–66.' },
    { text: 'J. D. Almeida, D. A. J. Tyrrell (1967). The morphology of three previously uncharacterized human respiratory viruses that grow in organ culture. Journal of General Virology 1, 175–178.' },
  ],
  Specimens: [
    { text: 'Amphipleura pellucida (Diatoms of North America).', url: 'https://diatoms.org/species/amphipleura_pellucida' },
    { text: 'Monazite-(Ce), Handbook of Mineralogy.', url: 'https://www.handbookofmineralogy.org/pdfs/monazite-Ce.pdf' },
    { text: 'CRT phosphor research (P1 willemite).', url: 'https://curtpalme.com/forum_archived/crt_phosphor_research_20090315.pdf' },
  ],
};
